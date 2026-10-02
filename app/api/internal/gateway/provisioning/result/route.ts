import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';
import { applyProvisioningResult } from '@/lib/voip/services/provisioning';

/**
 * The gateway agent reports the outcome of each claimed provisioning task
 * here. Results drive SipAccount.provisioningState so failures are visible
 * to operators instead of silently succeeding.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const taskId = typeof body.taskId === 'string' ? body.taskId : undefined;
  const ok = body.ok === true;
  const error = typeof body.error === 'string' ? body.error.slice(0, 500) : undefined;

  if (!taskId) {
    return NextResponse.json(
      { success: false, error: 'Invalid provisioning result' },
      { status: 400 }
    );
  }

  await applyProvisioningResult(taskId, { ok, error });

  return NextResponse.json({ success: true });
}
