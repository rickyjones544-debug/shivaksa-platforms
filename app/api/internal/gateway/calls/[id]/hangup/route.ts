import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CallStatus } from '@/lib/voip/constants';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';
import { queueCallHangup } from '@/lib/voip/services/provisioning';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ACTIVE_STATUSES: readonly string[] = [
  CallStatus.INITIATED,
  CallStatus.RINGING,
  CallStatus.ANSWERED,
];

/**
 * Internal gateway hangup endpoint.
 *
 * Queues a HANGUP_CALL provisioning task; the gateway agent executes
 * `channel request hangup` against the stored Asterisk channel name.
 * Final state/billing still arrive through the hangup-handler event report.
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const organizationId =
    typeof body.organizationId === 'string' && body.organizationId ? body.organizationId : undefined;
  if (!id || !organizationId) {
    return NextResponse.json({ success: false, error: 'Invalid hangup request' }, { status: 400 });
  }

  const call = await prisma.voipCall.findFirst({
    where: { gatewayCallId: id, organizationId },
  });

  if (!call) {
    return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
  }

  if (!ACTIVE_STATUSES.includes(call.status)) {
    return NextResponse.json({
      success: true,
      data: { gatewayCallId: id, requested: false, status: call.status },
    });
  }

  const channel =
    call.routingInfo && typeof call.routingInfo === 'object'
      ? (call.routingInfo as Record<string, unknown>).asteriskChannel
      : null;

  if (typeof channel === 'string' && channel) {
    await queueCallHangup(call.id, channel);
  }

  return NextResponse.json({
    success: true,
    data: { gatewayCallId: id, requested: true },
  });
}
