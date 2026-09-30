import { NextRequest, NextResponse } from 'next/server';
import { withRateDeskAuth } from '../../../../../utils';
import { addRateRow, updateDraftRates } from '@/lib/rate-desk/services/rate-sheets';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; version: string }> }
) {
  const { sheetId, version } = await params;
  const versionNumber = Number.parseInt(version, 10);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ success: false, error: 'Invalid version' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  return withRateDeskAuth({
    action: 'write',
    handler: (ctx) => addRateRow(ctx, sheetId, versionNumber, body),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; version: string }> }
) {
  const { sheetId, version } = await params;
  const versionNumber = Number.parseInt(version, 10);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ success: false, error: 'Invalid version' }, { status: 400 });
  }
  let body: { rates?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  return withRateDeskAuth({
    action: 'write',
    handler: (ctx) => updateDraftRates(ctx, sheetId, versionNumber, { rates: body?.rates }),
  });
}
