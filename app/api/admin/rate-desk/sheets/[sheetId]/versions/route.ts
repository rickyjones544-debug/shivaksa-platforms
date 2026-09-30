import { NextRequest } from 'next/server';
import { withRateDeskAuth } from '../../../utils';
import { createDraftFromCurrentVersion } from '@/lib/rate-desk/services/rate-sheets';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId } = await params;
  return withRateDeskAuth({
    action: 'write',
    handler: (ctx) => createDraftFromCurrentVersion(ctx, sheetId),
  });
}
