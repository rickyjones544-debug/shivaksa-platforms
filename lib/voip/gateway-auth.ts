import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Shared server-to-server authentication for the Asterisk gateway agent and
 * internal job endpoints. The key is a production-only secret
 * (GATEWAY_API_KEY) sent via the `x-gateway-api-key` header. It is never
 * exposed to browsers or customers, and it is compared in constant time.
 */
export function isAuthorizedGatewayRequest(request: Request): boolean {
  const expected = process.env.GATEWAY_API_KEY;
  const provided = request.headers.get('x-gateway-api-key');
  if (!expected || !provided) return false;
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function gatewayUnauthorized(): NextResponse {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
