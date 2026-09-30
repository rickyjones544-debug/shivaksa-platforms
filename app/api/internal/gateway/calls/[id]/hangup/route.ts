import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function getGatewayApiKey(): string {
  const key = process.env.GATEWAY_API_KEY;
  if (!key) throw new Error('GATEWAY_API_KEY is not configured');
  return key;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Internal gateway hangup endpoint placeholder.
 *
 * Phase 2B: accepts an authenticated request so the API contract exists,
 * but no actual Asterisk action is performed until Phase 3.
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const apiKey = request.headers.get('x-gateway-api-key');
  if (apiKey !== getGatewayApiKey()) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

  if (organizationId && organizationId !== call.organizationId) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    data: { gatewayCallId: id, requested: true },
  });
}
