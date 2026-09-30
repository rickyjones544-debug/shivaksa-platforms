import { NextRequest, NextResponse } from 'next/server';
import { withRateDeskAuth } from '../../../../../../utils';
import { deleteRateRow, updateRateRow } from '@/lib/rate-desk/services/rate-sheets';

async function resolveParams(
  params: Promise<{ sheetId: string; version: string; rateId: string }>
) {
  const { sheetId, version, rateId } = await params;
  const versionNumber = Number.parseInt(version, 10);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return null;
  }
  return { sheetId, versionNumber, rateId };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; version: string; rateId: string }> }
) {
  const resolved = await resolveParams(params);
  if (!resolved) {
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
    handler: (ctx) =>
      updateRateRow(ctx, resolved.sheetId, resolved.versionNumber, resolved.rateId, body),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sheetId: string; version: string; rateId: string }> }
) {
  const resolved = await resolveParams(params);
  if (!resolved) {
    return NextResponse.json({ success: false, error: 'Invalid version' }, { status: 400 });
  }
  return withRateDeskAuth({
    action: 'write',
    handler: (ctx) =>
      deleteRateRow(ctx, resolved.sheetId, resolved.versionNumber, resolved.rateId),
  });
}
