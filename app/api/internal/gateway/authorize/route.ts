import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';
import { authorizeAndRouteGatewayCall } from '@/lib/voip/services/gateway';

/**
 * Internal gateway call-authorization endpoint.
 *
 * Invoked by the Asterisk AGI script when an authenticated customer endpoint
 * INVITEs a destination. The server is authoritative: it validates the
 * account status, wallet, concurrency cap, and routing policy, creates the
 * call record + wallet reservation, and returns the carrier endpoint, dial
 * string, and policy-derived caller ID for Asterisk to dial.
 *
 * The customer's SIP From header is never trusted — `username` here is the
 * authenticated endpoint identity.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? body.username : undefined;
  const destination =
    typeof body.destination === 'string' ? body.destination.slice(0, 40) : undefined;
  const channel = typeof body.channel === 'string' ? body.channel.slice(0, 128) : undefined;
  const remoteAddress =
    typeof body.remoteAddress === 'string' ? body.remoteAddress.slice(0, 64) : undefined;

  if (!username || !destination || !/^\+?[0-9*#]{2,32}$/.test(destination)) {
    return NextResponse.json(
      {
        success: true,
        data: { authorized: false, reason: 'Invalid destination', hangupCause: 28 },
      },
      { status: 200 }
    );
  }

  const result = await authorizeAndRouteGatewayCall({
    username,
    destination,
    channel,
    remoteAddress,
  });

  return NextResponse.json({ success: true, data: result });
}
