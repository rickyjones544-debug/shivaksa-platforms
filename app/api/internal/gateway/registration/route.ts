import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';
import { prisma } from '@/lib/db/prisma';

/**
 * Internal gateway registration-state endpoint.
 *
 * The Asterisk gateway agent periodically reports observed contact state for
 * managed customer endpoints (derived from `pjsip show aors/contacts`). The
 * platform stores it as observability state only — a REGISTERED flag here is
 * never used as authentication evidence and never carries credentials.
 *
 * Request body: { registrations: [{ username, registered, contactAddress?,
 *   userAgent?, observedAt? }] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const entries = Array.isArray(body.registrations) ? body.registrations : [];

  if (entries.length === 0 || entries.length > 500) {
    return NextResponse.json(
      { success: false, error: 'Invalid registration report' },
      { status: 400 }
    );
  }

  let updated = 0;
  for (const entry of entries) {
    if (typeof entry?.username !== 'string' || typeof entry?.registered !== 'boolean') {
      continue;
    }
    const username = entry.username.slice(0, 64);
    const account = await prisma.sipAccount.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!account) continue;

    const observedAt = new Date();
    await prisma.sipAccount.update({
      where: { id: account.id },
      data: {
        registrationStatus: entry.registered ? 'REGISTERED' : 'UNREGISTERED',
        registrationObservedAt: observedAt,
        lastRegisteredAt: entry.registered ? observedAt : undefined,
        lastContactAddress:
          entry.registered && typeof entry.contactAddress === 'string'
            ? entry.contactAddress.slice(0, 128)
            : null,
        registrationUserAgent:
          typeof entry.userAgent === 'string' ? entry.userAgent.slice(0, 128) : null,
      },
    });
    updated += 1;
  }

  return NextResponse.json({ success: true, data: { updated } });
}
