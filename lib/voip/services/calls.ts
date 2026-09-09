import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CallStatus, ProviderName } from '@/lib/voip/constants';
import { getProvider, type ProviderWebhookEvent } from '@/lib/voip/providers';
import { authorizeOutboundCall, type OutboundAuthorization } from './call-authorization';
import {
  calculateBillableSeconds,
  calculateCustomerCharge,
  calculateGrossProfit,
  toDecimal,
} from './billing';
import { consumeReservation, releaseReservation, addDebit } from './wallet';
import { getOrCreateVoipService } from './customers';
import { audit } from './audit';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

export interface InitiateOutboundCallInput {
  sipAccountId: string;
  destination: string;
}

export async function initiateOutboundCall(
  ctx: AuthenticatedContext,
  input: InitiateOutboundCallInput
): Promise<OutboundAuthorization & { providerCallId: string | null }> {
  const authorization = await authorizeOutboundCall(ctx, input.sipAccountId, input.destination);

  const sipAccount = await prisma.sipAccount.findUnique({
    where: { id: authorization.sipAccountId },
  });

  if (!sipAccount) {
    throw new Error('SIP account not found after authorization');
  }

  const webhookUrl = `${process.env.APPLICATION_URL || ''}/api/voip/webhooks/telnyx`;
  const provider = getProvider(sipAccount.providerConnectionId ? 'telnyx' : undefined);

  let providerCallId: string | null = null;

  try {
    const result = await provider.createOutboundCall({
      providerConnectionId: sipAccount.providerConnectionId || process.env.TELNYX_CONNECTION_ID || '',
      from: authorization.callerId,
      to: authorization.destination,
      callerId: authorization.callerId,
      webhookUrl,
      maxDurationSeconds: authorization.maxDurationMinutes * 60,
      clientState: authorization.callId,
    });

    providerCallId = result.providerCallId;

    await prisma.voipCall.update({
      where: { id: authorization.callId },
      data: {
        providerCallId,
        status: CallStatus.RINGING,
        startTime: new Date(),
      },
    });

    await audit(ctx, 'CALL_INITIATED', 'VoipCall', authorization.callId, {
      destination: authorization.destination,
      providerCallId,
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

  return { ...authorization, providerCallId };
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
    include: { reservation: true, sipAccount: true },
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

async function reconcileCallBilling(call: { id: string; status: string; organizationId: string; direction: string; reservationId: string | null; durationSeconds: number | null; customerRate: Prisma.Decimal }, event: ProviderWebhookEvent) {
  const service = await getOrCreateVoipService(call.organizationId);

  const duration = call.durationSeconds ?? 0;
  const billingIncrement = service.billingIncrementSeconds;
  const minimumDuration = service.minimumBillableSeconds;

  const billableSeconds = calculateBillableSeconds(duration, billingIncrement, minimumDuration);
  const billedMinutes = toDecimal(billableSeconds).dividedBy(60).toDecimalPlaces(4);
  const customerCharge = calculateCustomerCharge(billableSeconds, call.customerRate);
  const wholesaleCost = event.wholesaleCost !== undefined ? event.wholesaleCost : null;
  const grossProfit = wholesaleCost ? calculateGrossProfit(customerCharge, wholesaleCost) : null;

  let walletUpdate = null;
  if (call.reservationId && call.direction === 'OUTBOUND') {
    walletUpdate = await consumeReservation(call.reservationId, customerCharge);
    await addDebit(call.organizationId, customerCharge, `Call ${call.id}`, call.id);
  } else if (call.direction === 'OUTBOUND') {
    // No reservation (legacy/manual path) — debit directly.
    await addDebit(call.organizationId, customerCharge, `Call ${call.id}`, call.id);
  }

  // Inbound billing is left configurable; do not debit by default.

  await prisma.voipCall.update({
    where: { id: call.id },
    data: {
      billableSeconds,
      billedMinutes,
      customerCharge,
      wholesaleCost,
      grossProfit,
      billingProcessed: true,
    },
  });

  await audit(null, call.status === CallStatus.COMPLETED ? 'CALL_COMPLETED' : 'CALL_FAILED', 'VoipCall', call.id, {
    duration,
    billableSeconds,
    customerCharge: customerCharge.toString(),
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
    include: { sipAccount: true, phoneNumber: true, reservation: true },
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

  const provider = getProvider(call.provider);
  await provider.hangupCall(call.providerCallId);

  await audit(ctx, 'CALL_HANGUP', 'VoipCall', call.id, { organizationId });

  return { success: true };
}
