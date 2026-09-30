import { NextRequest } from 'next/server';
import { withRateDeskAuth } from '../utils';
import { getRateHistory } from '@/lib/rate-desk/services/comparison';

// Internal rate-history view over immutable version snapshots. providerId or
// sheetId narrows scope; all filters are validated server-side.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const page = q.get('page') ? Number.parseInt(q.get('page')!, 10) : undefined;
  const pageSize = q.get('pageSize') ? Number.parseInt(q.get('pageSize')!, 10) : undefined;

  return withRateDeskAuth({
    action: 'read',
    handler: (ctx) =>
      getRateHistory(ctx, {
        providerId: q.get('providerId') ?? undefined,
        sheetId: q.get('sheetId') ?? undefined,
        countryIso: q.get('countryIso') ?? undefined,
        destination: q.get('destination') ?? undefined,
        prefix: q.get('prefix') ?? undefined,
        routeType: q.get('routeType') ?? undefined,
        currency: q.get('currency') ?? undefined,
        effectiveDate: q.get('effectiveDate') ?? undefined,
        versionStatus: q.get('versionStatus') ?? undefined,
        page,
        pageSize,
      }),
  });
}
