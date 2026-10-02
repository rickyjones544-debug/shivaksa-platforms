import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CallStatus } from '@/lib/voip/constants';
import { reconcileCallBilling } from '@/lib/voip/services/calls';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';

const FINAL_STATUSES: readonly string[] = [
  CallStatus.COMPLETED,
  CallStatus.FAILED,
  CallStatus.BUSY,
  CallStatus.NO_ANSWER,
  CallStatus.CANCELLED,
];

function mapEventToStatus(eventType: string): string | null {
  switch (eventType) {
    case 'call.initiated':
      return CallStatus.INITIATED;
    case 'call.ringing':
      return CallStatus.RINGING;
    case 'call.answered':
      return CallStatus.ANSWERED;
    case 'call.completed':
      return CallStatus.COMPLETED;
    case 'call.failed':
      return CallStatus.FAILED;
    case 'call.busy':
      return CallStatus.BUSY;
    case 'call.no_answer':
      return CallStatus.NO_ANSWER;
    case 'call.cancelled':
      return CallStatus.CANCELLED;
    default:
      return null;
  }
}

/**
 * Internal gateway events endpoint.
 *
 * Receives call lifecycle events from the Asterisk gateway agent / dialplan
 * hangup handler. Final events reconcile billing via reconcileCallBilling;
 * duplicate finals are safe (billingProcessed gate).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const gatewayCallId =
    typeof body.gatewayCallId === 'string' ? body.gatewayCallId : undefined;
  const eventType = typeof body.eventType === 'string' ? body.eventType : undefined;
  const organizationId =
    typeof body.organizationId === 'string' ? body.organizationId : undefined;

  const status = eventType ? mapEventToStatus(eventType) : null;
  const durationSeconds = body.durationSeconds;
  const sipResponseCode = body.sipResponseCode;
  if (
    !gatewayCallId ||
    !organizationId ||
    !status ||
    (durationSeconds !== undefined &&
      (!Number.isInteger(durationSeconds) || durationSeconds < 0)) ||
    (sipResponseCode !== undefined &&
      (!Number.isInteger(sipResponseCode) || sipResponseCode < 100 || sipResponseCode > 699))
  ) {
    return NextResponse.json({ success: false, error: 'Invalid gateway event' }, { status: 400 });
  }

  const call = await prisma.voipCall.findFirst({
    where: { gatewayCallId, organizationId },
    include: { carrierRate: true },
  });

  if (!call) {
    return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
  }

  // Defense-in-depth: if the caller provides an organizationId, it must match
  // the call owner. The internal gateway may omit this when operating as the
  // single trusted service account.
  if (organizationId && organizationId !== call.organizationId) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    );
  }

  if (FINAL_STATUSES.includes(call.status) && call.billingProcessed) {
    return NextResponse.json({ success: true, data: { callId: call.id, status: call.status } });
  }

  const isFinal = FINAL_STATUSES.includes(status);
  if (
    status === call.status &&
    !isFinal &&
    durationSeconds === undefined &&
    sipResponseCode === undefined &&
    body.failureReason === undefined
  ) {
    return NextResponse.json({ success: true, data: { callId: call.id, status: call.status } });
  }
  const answerTime = status === CallStatus.ANSWERED && !call.answerTime ? new Date() : call.answerTime;
  const endTime = isFinal && !call.endTime ? new Date() : call.endTime;
  const nextDurationSeconds =
    typeof durationSeconds === 'number' ? durationSeconds : call.durationSeconds;
  const nextSipResponseCode =
    typeof sipResponseCode === 'number' ? sipResponseCode : call.sipResponseCode;
  const failureReason =
    typeof body.failureReason === 'string' ? body.failureReason : call.failureReason;

  const updated = await prisma.voipCall.update({
    where: { id: call.id },
    data: {
      status,
      answerTime,
      endTime,
      durationSeconds: nextDurationSeconds,
      sipResponseCode: nextSipResponseCode,
      failureReason,
    },
  });

  if (isFinal && !call.billingProcessed) {
    await reconcileCallBilling(
      {
        id: updated.id,
        status: updated.status,
        organizationId: updated.organizationId,
        direction: updated.direction,
        reservationId: updated.reservationId,
        durationSeconds: updated.durationSeconds,
        customerRate: updated.customerRate,
        billingIncrementSeconds: updated.billingIncrementSeconds,
        minimumBillableSeconds: updated.minimumBillableSeconds,
        endTime: updated.endTime,
        carrierRate: call.carrierRate,
      },
      undefined
    );
  }

  return NextResponse.json({ success: true, data: { callId: call.id, status } });
}
