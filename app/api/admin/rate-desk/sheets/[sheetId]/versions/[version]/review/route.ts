import { NextRequest, NextResponse } from 'next/server';
import { withRateDeskAuth } from '../../../../../utils';
import { getVersionReview, submitVersionForReview } from '@/lib/rate-desk/services/review';

function parseVersion(version: string): number | null {
  const n = Number.parseInt(version, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

// Internal review summary for a rate-sheet version — read-only.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; version: string }> }
) {
  const { sheetId, version } = await params;
  const versionNumber = parseVersion(version);
  if (versionNumber === null) {
    return NextResponse.json({ success: false, error: 'Invalid version' }, { status: 400 });
  }
  return withRateDeskAuth({
    action: 'read',
    handler: (ctx) => getVersionReview(ctx, sheetId, versionNumber),
  });
}

// Submit a DRAFT version for internal review.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; version: string }> }
) {
  const { sheetId, version } = await params;
  const versionNumber = parseVersion(version);
  if (versionNumber === null) {
    return NextResponse.json({ success: false, error: 'Invalid version' }, { status: 400 });
  }
  return withRateDeskAuth({
    action: 'write',
    handler: (ctx) => submitVersionForReview(ctx, sheetId, versionNumber),
  });
}
