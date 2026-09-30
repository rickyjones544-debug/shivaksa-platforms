import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CallStatus, ProviderName } from '@/lib/voip/constants';
import { getProvider, getProviderForCarrier, type ProviderWebhookEvent } from '@/lib/voip/providers';
import { authorizeOutboundCall, type OutboundAuthorization } from './call-authorization';
import {
  calculateBillableSeconds,
  calculateCustomerCharge,
  calculateWholesaleCost,
  calculateGrossProfit,
  toDecimal,
} from './billing';
import { consumeReservation, releaseReservation, addDebit } from './wallet';
import { getOrCreateVoipService } from './customers';
import { audit } from './audit';
import { assertVoipEligibility } from './eligibility';
import { selectRoute, type RouteResult } from './routing';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

export interface InitiateOutboundCallInput {
  sipAccountId: string;
  destination: string;
}

export async function initiateOutboundCall(
  ctx: AuthenticatedContext,
  input: InitiateOutboundCallInput
): Promise<OutboundAuthorization & { providerCallId: string | null; route?: RouteResult }> {
  if (!ctx.organization) {
    throw new Error('No active organization');
  }
  await assertVoipEligibility(ctx.organization.id);
  const authorization = await authorizeOutboundCall(ctx, input.sipAccountId, input.destination);

  const sipAccount = await prisma.sipAccount.findUnique({
    where: { id: authorization.sipAccountId },
  });

  if (!sipAccount) {
    throw new Error('SIP account not found after authorization');
  }

  let route: RouteResult | undefined;
  let providerCallId: string | null = null;
  let gatewayCallId: string | null = null;

  try {
    // Select carrier, rate, and transformed destination.
    route = await selectRoute({
      organizationId: ctx.organization.id,
      destination: input.destination,
      sipAccount,
    });

    await prisma.voipCall.update({
      where: { id: authorization.callId },
      data: {
        carrierId: route.carrier.id,
        carrierRateId: route.rate.id,
        normalizedDestination: route.normalized.digits,
        destinationCountry: route.normalized.countryIso,
        destinationType: route.normalized.destinationType,
        callerId: route.callerId,
        provider: route.carrier.code,
        wholesaleRate: route.rate.rate,
      },
    });

    const provider = getProviderForCarrier(route.carrier);

    const outboundInput = buildOutboundInput(route, authorization, sipAccount, ctx.organization.id);
    const result = await provider.createOutboundCall(outboundInput);

    providerCallId = result.providerCallId;
    gatewayCallId = route.carrier.type === 'SIP_GATEWAY' ? result.providerCallId : null;

    await prisma.voipCall.update({
      where: { id: authorization.callId },
      data: {
        providerCallId,
        gatewayCallId,
        status: CallStatus.RINGING,
        startTime: new Date(),
      },
    });

    await audit(ctx, 'CALL_INITIATED', 'VoipCall', authorization.callId, {
      destination: authorization.destination,
      normalizedDestination: route.normalized.digits,
      carrierId: route.carrier.id,
      carrierRateId: route.rate.id,
      providerCallId,
      gatewayCallId,
    });
  } catch (error) {
    await releaseReservation(authorization.reservationId);
    await prisma.voipCall.update({
      where: { id: authorization.callId },
      data: {
        status: CallStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Provider error',
      },
    });
    throw error;
  }

  return { ...authorization, providerCallId, route };
}

function buildOutboundInput(
  route: RouteResult,
  authorization: OutboundAuthorization,
  sipAccount: { providerConnectionId: string | null },
  organizationId: string
): Parameters<ReturnType<typeof getProviderForCarrier>['createOutboundCall']>[0] {
  const maxDurationSeconds = authorization.maxDurationMinutes * 60;

  if (route.carrier.type === 'API') {
    return {
      providerConnectionId: sipAccount.providerConnectionId || '',
      from: route.callerId,
      to: route.normalized.e164,
      callerId: route.callerId,
      webhookUrl: `${process.env.APPLICATION_URL || ''}/api/voip/webhooks/telnyx`,
      maxDurationSeconds,
      clientState: authorization.callId,
      organizationId,
    };
  }

  return {
    providerConnectionId: '',
    from: route.callerId,
    to: route.normalized.e164,
    callerId: route.callerId,
    webhookUrl: `${process.env.APPLICATION_URL || ''}/api/internal/gateway/events`,
    maxDurationSeconds,
    clientState: authorization.callId,
    organizationId,
    carrier: route.carrier,
    carrierRate: route.rate,
    dialString: route.dialString,
    gatewayCallId: undefined,
  };
}

export async function handleProviderWebhook(
  rawBody: string,
  signature: string,
  timestamp: string
): Promise<{ processed: boolean; providerEventId: string; callId?: string; error?: string }> {
  const provider = getProvider(ProviderName.TELNYX);
  const result = await provider.handleWebhook(rawBody, signature, timestamp);

  if (!result.processed || !result.event) {
    return {
      processed: false,
      providerEventId: result.providerEventId || 'unknown',
      error: result.error || 'Webhook not processed',
    };
  }

  const event = result.event;
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_providerEventId: { provider: ProviderName.TELNYX, providerEventId: event.providerEventId } },
  });

  if (existing) {
    await audit(null, 'WEBHOOK_DUPLICATE', 'WebhookEvent', existing.id, {
      providerEventId: event.providerEventId,
    });
    return {
      processed: true,
      providerEventId: event.providerEventId,
      callId: existing.callId || undefined,
    };
  }

  const webhookRecord = await prisma.webhookEvent.create({
    data: {
      provider: ProviderName.TELNYX,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      payload: event.rawPayload as unknown as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  });

  const call = await findAndUpdateCall(event);

  await prisma.webhookEvent.update({
    where: { id: webhookRecord.id },
    data: {
      status: 'PROCESSED',
      callId: call?.id,
      processedAt: new Date(),
    },
  });

  await audit(null, 'WEBHOOK_PROCESSED', 'WebhookEvent', webhookRecord.id, {
    providerEventId: event.providerEventId,
    callId: call?.id,
    status: event.callStatus,
  });

  return {
    processed: true,
    providerEventId: event.providerEventId,
    callId: call?.id,
  };
}

async function findAndUpdateCall(event: ProviderWebhookEvent) {
  if (!event.providerCallId) return null;

  const call = await prisma.voipCall.findFirst({
    where: { providerCallId: event.providerCallId },
    include: { reservation: true, sipAccount: true, carrierRate: true },
  });

  if (!call) return null;

  const status = event.callStatus || call.status;
  const finalStatuses: readonly string[] = ['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER', 'CANCELLED'];
  const isFinal = finalStatuses.includes(status);

  const updateData: Prisma.VoipCallUpdateInput = {
    status,
    answerTime: event.answerTime ?? call.answerTime,
    endTime: isFinal ? event.endTime ?? new Date() : call.endTime,
    durationSeconds: event.durationSeconds ?? call.durationSeconds,
    failureReason: event.failureReason ?? call.failureReason,
    direction: event.direction ?? call.direction,
  };

  const updated = await prisma.voipCall.update({
    where: { id: call.id },
    data: updateData,
  });

  if (isFinal && !call.billingProcessed) {
    await reconcileCallBilling(updated, event);
  }

  return updated;
}

export async function reconcileCallBilling(
  call: {
    id: string;
    status: string;
    organizationId: string;
    direction: string;
    reservationId: string | null;
    durationSeconds: number | null;
    customerRate: Prisma.Decimal;
    wholesaleRate?: Prisma.Decimal | null;
    carrierRate?: { rate: Prisma.Decimal; billingIncrementSeconds: number; minimumBillableSeconds: number } | null;
  },
  event?: ProviderWebhookEvent
) {
  const service = await getOrCreateVoipService(call.organizationId);

  const duration = call.durationSeconds ?? 0;
  const customerBillingIncrement = service.billingIncrementSeconds;
  const customerMinimumDuration = service.minimumBillableSeconds;

  const billableSeconds = calculateBillableSeconds(duration, customerBillingIncrement, customerMinimumDuration);
  const billedMinutes = toDecimal(billableSeconds).dividedBy(60).toDecimalPlaces(4);
  const customerCharge = calculateCustomerCharge(billableSeconds, call.customerRate);

  // Use the rate captured at call-creation time. If the carrier rate row is
  // updated later, historical calls still bill against their stored wholesaleRate.
  let wholesaleCost: Prisma.Decimal | null = null;
  let wholesaleRate: Prisma.Decimal | null = null;

  if (event?.wholesaleCost !== undefined) {
    wholesaleCost = event.wholesaleCost;
  } else {
    const effectiveWholesaleRate =
      call.wholesaleRate ?? (call.carrierRate ? call.carrierRate.rate : null);
    if (effectiveWholesaleRate) {
      const carrierBillingIncrement = call.carrierRate?.billingIncrementSeconds ?? 1;
      const carrierMinimumDuration = call.carrierRate?.minimumBillableSeconds ?? 1;
      const wholesaleBillableSeconds = calculateBillableSeconds(
        duration,
        carrierBillingIncrement,
        carrierMinimumDuration
      );
      wholesaleCost = calculateWholesaleCost(wholesaleBillableSeconds, effectiveWholesaleRate);
      wholesaleRate = effectiveWholesaleRate;
    }
  }

  const grossProfit = calculateGrossProfit(customerCharge, wholesaleCost);

  let walletUpdate = null;
  if (call.reservationId && call.direction === 'OUTBOUND') {
    walletUpdate = await consumeReservation(call.reservationId, customerCharge);
  } else if (call.direction === 'OUTBOUND') {
    walletUpdate = await addDebit(
      call.organizationId,
      customerCharge,
      `Call ${call.id}`,
      call.id,
      `call:${call.id}:debit`
    );
  }

  await prisma.voipCall.update({
    where: { id: call.id },
    data: {
      billableSeconds,
      billedMinutes,
      customerCharge,
      wholesaleRate,
      wholesaleCost,
      grossProfit,
      billingProcessed: true,
    },
  });

  await audit(null, call.status === CallStatus.COMPLETED ? 'CALL_COMPLETED' : 'CALL_FAILED', 'VoipCall', call.id, {
    duration,
    billableSeconds,
    customerCharge: customerCharge.toString(),
    wholesaleRate: wholesaleRate?.toString(),
    wholesaleCost: wholesaleCost?.toString(),
    grossProfit: grossProfit?.toString(),
  });

  return walletUpdate;
}

export async function listCalls(organizationId: string, take = 100, skip = 0) {
  return prisma.voipCall.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });
}

export async function getCall(organizationId: string, id: string) {
  return prisma.voipCall.findFirst({
    where: { id, organizationId },
    include: { sipAccount: true, phoneNumber: true, reservation: true, carrier: true, carrierRate: true },
  });
}

export async function hangupCall(ctx: AuthenticatedContext, organizationId: string, callId: string) {
  const call = await getCall(organizationId, callId);
  if (!call || call.organizationId !== organizationId) {
    throw new Error('Call not found');
  }

  if (!call.providerCallId) {
    throw new Error('Call has not been sent to the provider yet');
  }

  const provider = call.carrier ? getProviderForCarrier(call.carrier) : getProvider(call.provider);
  await provider.hangupCall(call.providerCallId, organizationId);

  await audit(ctx, 'CALL_HANGUP', 'VoipCall', call.id, { organizationId });

  return { success: true };
}
