import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/prisma';

function getGatewayApiKey(): string {
  const key = process.env.GATEWAY_API_KEY;
  if (!key) throw new Error('GATEWAY_API_KEY is not configured');
  return key;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

/**
 * Internal gateway call origination endpoint.
 *
 * Phase 2B: this endpoint accepts the call from the SIP gateway provider adapter,
 * validates the shared secret, and returns a generated gateway call id.
 * It does NOT connect to Asterisk yet; that integration is Phase 3.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = request.headers.get('x-gateway-api-key');
  if (apiKey !== getGatewayApiKey()) {
    return unauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const callId = typeof body.callId === 'string' && body.callId ? body.callId : undefined;
  const organizationId =
    typeof body.organizationId === 'string' && body.organizationId ? body.organizationId : undefined;
  const carrierId = typeof body.carrierId === 'string' && body.carrierId ? body.carrierId : undefined;
  const carrierCode =
    typeof body.carrierCode === 'string' && body.carrierCode ? body.carrierCode : undefined;
  const dialString =
    typeof body.dialString === 'string' && /^\d{7,30}$/.test(body.dialString)
      ? body.dialString
      : undefined;

  if (!callId || !organizationId || !carrierId || !carrierCode || !dialString) {
    return NextResponse.json({ success: false, error: 'Invalid gateway call request' }, { status: 400 });
  }

  const call = await prisma.voipCall.findFirst({
    where: { id: callId, organizationId, carrierId },
    select: { id: true },
  });
  if (!call) {
    return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
  }

  const gatewayCallId = randomUUID();

  return NextResponse.json({
    success: true,
    data: {
      gatewayCallId,
      accepted: true,
      callId,
      carrierCode,
      dialString,
    },
  });
}
