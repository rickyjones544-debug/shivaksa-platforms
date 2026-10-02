import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';
import { authorizeInboundCall } from '@/lib/voip/services/call-authorization';

/**
 * Internal gateway inbound-authorization endpoint.
 *
 * Invoked by the Asterisk AGI script when a carrier (e.g. Telnyx) delivers an
 * inbound DID call. Looks up the dialed number in phone_numbers, creates the
 * INBOUND VoipCall record, and returns the SIP account's Asterisk endpoint
 * name for the dialplan to ring. Rejects when the DID is unknown/inactive or
 * has no SIP account assigned.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const destination =
    typeof body.destination === 'string' ? body.destination.slice(0, 40) : undefined;
  const callerId =
    typeof body.callerId === 'string' ? body.callerId.slice(0, 40) : 'anonymous';
  const providerCallId =
    typeof body.providerCallId === 'string' ? body.providerCallId.slice(0, 128) : '';
  const provider =
    typeof body.provider === 'string' ? body.provider.slice(0, 40) : undefined;

  if (!destination || !/^\+?[0-9]{5,32}$/.test(destination)) {
    return NextResponse.json(
      { success: true, data: { authorized: false, reason: 'Invalid destination' } },
      { status: 200 }
    );
  }

  const normalized = destination.startsWith('+') ? destination : `+${destination}`;
  const result = await authorizeInboundCall(providerCallId, normalized, callerId, provider);

  if (!result || !result.asteriskEndpoint) {
    return NextResponse.json(
      { success: true, data: { authorized: false, reason: 'No route for destination' } },
      { status: 200 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      authorized: true,
      gatewayCallId: result.callId,
      organizationId: result.organizationId,
      sipAccountId: result.sipAccountId,
      asteriskEndpoint: result.asteriskEndpoint,
    },
  });
}
