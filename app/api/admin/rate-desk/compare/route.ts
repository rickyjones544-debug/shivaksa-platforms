import { NextRequest } from 'next/server';
import { withRateDeskAuth } from '../utils';
import { compareApprovedRates } from '@/lib/rate-desk/services/comparison';

// Internal comparison of approved provider rates. Query params are all
// optional filters; organization scope comes from the session, never the URL.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const providerIds = q.get('providerIds')
    ? q.get('providerIds')!.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const page = q.get('page') ? Number.parseInt(q.get('page')!, 10) : undefined;
  const pageSize = q.get('pageSize') ? Number.parseInt(q.get('pageSize')!, 10) : undefined;

  return withRateDeskAuth({
    action: 'read',
    handler: (ctx) =>
      compareApprovedRates(ctx, {
        providerIds,
        countryIso: q.get('countryIso') ?? undefined,
        destination: q.get('destination') ?? undefined,
        prefix: q.get('prefix') ?? undefined,
        routeType: q.get('routeType') ?? undefined,
        currency: q.get('currency') ?? undefined,
        effectiveDate: q.get('effectiveDate') ?? undefined,
        sortBy: q.get('sortBy') ?? undefined,
        page,
        pageSize,
      }),
  });
}
