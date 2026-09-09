import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CallDirection, CallStatus, SipAccountStatus } from '@/lib/voip/constants';
import { toDecimal, getMaxCallCost, getReserveAmount } from './billing';
import { reserveForCall, InsufficientBalanceError } from './wallet';

import type { AuthenticatedContext } from '@/lib/rbac/authorization';

const E164_REGEX = /^\+1[2-9]\d{9}$/;
const ALLOWED_DESTINATIONS: RegExp[] = [E164_REGEX];

export class CallAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallAuthorizationError';
  }
}

export function validateDestination(destination: string): boolean {
  return ALLOWED_DESTINATIONS.some((regex) => regex.test(destination));
}

export interface OutboundAuthorization {
  callId: string;
  sipAccountId: string;
  callerId: string;
  destination: string;
  reservationId: string;
  reservedAmount: Prisma.Decimal;
  maxDurationMinutes: number;
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
    include: { organization: { include: { voipService: true, wallet: true } }, phoneNumbers: true },
  });

  if (!sipAccount || sipAccount.organizationId !== ctx.organization.id) {
    throw new CallAuthorizationError('SIP account not found');
  }

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

  if (!validateDestination(destination)) {
    throw new CallAuthorizationError('Destination is not allowed');
  }

  const activeCalls = await prisma.voipCall.count({
    where: {
      sipAccountId: sipAccount.id,
      status: { in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] },
    },
  });

  if (activeCalls >= sipAccount.maxConcurrentCalls) {
    throw new CallAuthorizationError('Maximum concurrent calls reached for this SIP account');
  }

  const customerRate = toDecimal(service.customerRate);
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

  // Create the internal call record first, then reserve funds.
  const call = await prisma.voipCall.create({
    data: {
      organizationId: ctx.organization.id,
      sipAccountId: sipAccount.id,
      direction: CallDirection.OUTBOUND,
      callerId: sipAccount.callerId || sipAccount.username,
      destination,
      status: CallStatus.INITIATED,
      customerRate,
    },
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
    reservationId: reservation.id,
    reservedAmount: maxCallCost,
    maxDurationMinutes: maxDuration,
  };
}

export interface InboundAuthorization {
  callId: string;
  organizationId: string;
  sipAccountId: string | null;
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
    providerCallId,
    callerId,
    destination,
  };
}
