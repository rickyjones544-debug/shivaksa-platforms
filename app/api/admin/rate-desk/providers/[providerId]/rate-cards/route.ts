import { NextRequest } from 'next/server';
import { withRateDeskAuth } from '../../../utils';
import { listRateCardDocuments } from '@/lib/rate-desk/services/rate-sheets';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params;
  return withRateDeskAuth({
    action: 'read',
    handler: (ctx) => listRateCardDocuments(ctx, providerId),
  });
}
