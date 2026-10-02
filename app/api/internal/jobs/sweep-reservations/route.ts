import { NextRequest, NextResponse } from 'next/server';
import { sweepExpiredReservations } from '@/lib/voip/services/wallet';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';

/**
 * Internal maintenance endpoint — releases expired wallet reservations left
 * behind by calls that never reached a final status.
 *
 * Invoke on a schedule (e.g. a cron hitting this endpoint every few minutes).
 * The bundled Asterisk gateway agent (asterisk-gateway/) already calls this
 * every few minutes; an external cron is a valid alternative, e.g.:
 *
 *   *\/5 * * * * curl -sf -X POST https://app.shivaksatechnology.com/api/internal/jobs/sweep-reservations -H "x-gateway-api-key: $GATEWAY_API_KEY"
 *
 * Authenticated with the same shared internal secret as the gateway API.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const result = await sweepExpiredReservations();
  return NextResponse.json({ success: true, data: result });
}
