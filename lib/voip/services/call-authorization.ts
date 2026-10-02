import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CallDirection, CallStatus, SipAccountStatus } from '@/lib/voip/constants';
import { toDecimal, getMaxCallCost, getReserveAmount } from './billing';
import { getCustomerRate } from './customer-rates';
import { reserveForCall, InsufficientBalanceError } from './wallet';
import {
  normalizeDestination,
  validateDestination as validateNormalizedDestination,
  type NormalizedDestination,
} from './normalization';

import type { AuthenticatedContext } from '@/lib/rbac/authorization';

export class CallAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallAuthorizationError';
  }
}

export function validateDestination(destination: string): boolean {
  return validateNormalizedDestination(destination);
}

export interface OutboundAuthorization {
  callId: string;
  sipAccountId: string;
  callerId: string;
  destination: string;
  normalizedDestination: NormalizedDestination;
  reservationId: string;
  reservedAmount: Prisma.Decimal;
  maxDurationMinutes: number;
}

type LoadedSipAccount = Prisma.SipAccountGetPayload<{
  include: {
    organization: { include: { voipService: true; wallet: true } };
    phoneNumbers: true;
  };
}>;

const sipAccountLoadInclude = {
  organization: { include: { voipService: true, wallet: true } },
  phoneNumbers: true,
} as const;

/**
 * Shared authorization core for outbound calls — used by both the web/API
 * call-origination path and the Asterisk gateway path. The concurrent-call
 * check and the call record creation run inside a transaction guarded by a
 * Postgres advisory lock keyed on the SIP account, so simultaneous call
 * attempts cannot both slip past maxConcurrentCalls.
 */
async function authorizeLoadedAccount(
  sipAccount: LoadedSipAccount,
  destination: string
): Promise<OutboundAuthorization> {
  if (sipAccount.status !== SipAccountStatus.ACTIVE) {
    throw new CallAuthorizationError('SIP account is disabled');
  }

  const service = sipAccount.organization.voipService;
  if (!service) {
    throw new CallAuthorizationError('VoIP service not configured');
  }

  if (service.isAdminSuspended) {
    throw new CallAuthorizationError('Service is suspended');
  }

  const wallet = sipAccount.organization.wallet;
  if (!wallet) {
    throw new CallAuthorizationError('Wallet not configured');
  }

  let normalized: NormalizedDestination;
  try {
    normalized = normalizeDestination(destination);
  } catch (error) {
    if (error instanceof Error) {
      throw new CallAuthorizationError(error.message);
    }
    throw new CallAuthorizationError('Destination is not allowed');
  }

  // Customer selling-rate selection (Phase 3): the org's ACTIVE rate card
  // decides the per-destination price; without a card the legacy flat service
  // rate applies. Never falls back to carrier wholesale cost. A card with no
  // matching prefix throws CustomerRateError instead of billing $0.
  const pricing = await getCustomerRate(sipAccount.organizationId, normalized, new Date(), service);
  const customerRate = pricing.rate;
  const reserve = getReserveAmount(customerRate, service.reserveMinutes);
  const available = toDecimal(wallet.balance).minus(wallet.reserved);

  if (available.lessThanOrEqualTo(reserve)) {
    throw new InsufficientBalanceError(
      'Your available balance is too low to place a new call. Please add funds to continue calling.'
    );
  }

  const maxDuration = service.maxCallDurationMinutes;
  const maxCallCost = getMaxCallCost(customerRate, maxDuration);

  if (available.minus(maxCallCost).lessThan(reserve)) {
    throw new InsufficientBalanceError(
      'Your available balance is too low to place a new call. Please add funds to continue calling.'
    );
  }

  // Advisory-lock + count + create in one transaction: concurrent call
  // attempts against the same SIP account serialize here, so the
  // maxConcurrentCalls limit cannot be bypassed by parallel registrations.
  const call = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sipAccount.id}, 0))`;

    const activeCalls = await tx.voipCall.count({
      where: {
        sipAccountId: sipAccount.id,
        status: { in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] },
      },
    });

    if (activeCalls >= sipAccount.maxConcurrentCalls) {
      throw new CallAuthorizationError('Maximum concurrent calls reached for this SIP account');
    }

    // Create the internal call record first, then reserve funds.
    return tx.voipCall.create({
      data: {
        organizationId: sipAccount.organizationId,
        sipAccountId: sipAccount.id,
        direction: CallDirection.OUTBOUND,
        callerId: sipAccount.callerId || sipAccount.username,
        destination,
        normalizedDestination: normalized.digits,
        destinationCountry: normalized.countryIso,
        destinationType: normalized.destinationType,
        status: CallStatus.INITIATED,
        customerRate,
        // Pricing snapshot — the CDR must explain itself even after the rate
        // card is edited later.
        customerRateCardId: pricing.customerRateCardId,
        customerRateId: pricing.customerRateId,
        billingIncrementSeconds: pricing.billingIncrementSeconds,
        minimumBillableSeconds: pricing.minimumBillableSeconds,
      },
    });
  });

  await reserveForCall(wallet.id, call.id, maxCallCost, reserve);

  const reservation = await prisma.walletReservation.findUnique({
    where: { callId: call.id },
  });

  if (!reservation) {
    await prisma.voipCall.update({
      where: { id: call.id },
      data: { status: CallStatus.FAILED, failureReason: 'Wallet reservation failed' },
    });
    throw new InsufficientBalanceError('Wallet reservation failed');
  }

  await prisma.voipCall.update({
    where: { id: call.id },
    data: { reservationId: reservation.id },
  });

  return {
    callId: call.id,
    sipAccountId: sipAccount.id,
    callerId: call.callerId,
    destination,
    normalizedDestination: normalized,
    reservationId: reservation.id,
    reservedAmount: maxCallCost,
    maxDurationMinutes: maxDuration,
  };
}

export async function authorizeOutboundCall(
  ctx: AuthenticatedContext,
  sipAccountId: string,
  destination: string
): Promise<OutboundAuthorization> {
  if (!ctx.organization) {
    throw new CallAuthorizationError('No active organization');
  }

  const sipAccount = await prisma.sipAccount.findUnique({
    where: { id: sipAccountId },
    include: sipAccountLoadInclude,
  });

  if (!sipAccount || sipAccount.organizationId !== ctx.organization.id) {
    throw new CallAuthorizationError('SIP account not found');
  }

  return authorizeLoadedAccount(sipAccount, destination);
}

/**
 * Gateway entry point: authorize an outbound call originated by a registered
 * customer SIP endpoint on the Asterisk gateway. The endpoint's digest-auth
 * username is the trusted identity — the SIP From header is never consulted.
 * Returns the loaded account so the caller can continue with routing.
 */
export async function authorizeGatewayCall(
  username: string,
  destination: string
): Promise<{ authorization: OutboundAuthorization; sipAccount: LoadedSipAccount }> {
  const sipAccount = await prisma.sipAccount.findUnique({
    where: { username },
    include: sipAccountLoadInclude,
  });

  if (!sipAccount) {
    throw new CallAuthorizationError('Unknown SIP account');
  }

  const authorization = await authorizeLoadedAccount(sipAccount, destination);
  return { authorization, sipAccount };
}

export interface InboundAuthorization {
  callId: string;
  organizationId: string;
  sipAccountId: string | null;
  asteriskEndpoint: string | null;
  providerCallId: string;
  callerId: string;
  destination: string;
}

export async function authorizeInboundCall(
  providerCallId: string,
  destination: string,
  callerId: string,
  provider?: string
): Promise<InboundAuthorization | null> {
  const number = await prisma.phoneNumber.findFirst({
    where: { number: destination, status: 'ACTIVE' },
    include: { organization: { include: { voipService: true } }, sipAccount: true },
  });

  if (!number) return null;

  const service = number.organization.voipService;
  if (!service || service.isAdminSuspended) {
    return null;
  }

  const sipAccountId = number.sipAccountId;

  const call = await prisma.voipCall.create({
    data: {
      organizationId: number.organizationId,
      sipAccountId: sipAccountId,
      phoneNumberId: number.id,
      direction: CallDirection.INBOUND,
      callerId,
      destination,
      status: CallStatus.INITIATED,
      provider: provider || 'telnyx',
      providerCallId,
      customerRate: toDecimal(service.customerRate),
    },
  });

  return {
    callId: call.id,
    organizationId: number.organizationId,
    sipAccountId,
    asteriskEndpoint: number.sipAccount?.asteriskEndpoint ?? null,
    providerCallId,
    callerId,
    destination,
  };
}
