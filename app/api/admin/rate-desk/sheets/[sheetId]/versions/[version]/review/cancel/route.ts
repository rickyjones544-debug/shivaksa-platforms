import { NextRequest, NextResponse } from 'next/server';
import { withRateDeskAuth } from '../../../../../../utils';
import { cancelVersionReview } from '@/lib/rate-desk/services/review';

// Withdraw a version from review — the draft stays editable.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; version: string }> }
) {
  const { sheetId, version } = await params;
  const versionNumber = Number.parseInt(version, 10);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ success: false, error: 'Invalid version' }, { status: 400 });
  }
  return withRateDeskAuth({
    action: 'write',
    handler: (ctx) => cancelVersionReview(ctx, sheetId, versionNumber),
  });
}
