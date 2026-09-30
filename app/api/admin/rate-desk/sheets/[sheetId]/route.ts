import { NextRequest } from 'next/server';
import { withRateDeskAuth } from '../../utils';
import { getRateSheet } from '@/lib/rate-desk/services/rate-sheets';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId } = await params;
  return withRateDeskAuth({
    action: 'read',
    handler: (ctx) => getRateSheet(ctx, sheetId),
  });
}
