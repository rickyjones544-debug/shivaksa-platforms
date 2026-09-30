import { NextRequest, NextResponse } from 'next/server';
import { withRateDeskAuth } from '../utils';
import { createRateSheet, listRateSheets } from '@/lib/rate-desk/services/rate-sheets';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const providerId = params.get('providerId') ?? undefined;
  const status = params.get('status') ?? undefined;
  return withRateDeskAuth({
    action: 'read',
    handler: (ctx) => listRateSheets(ctx, { providerId, status }),
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  return withRateDeskAuth({
    action: 'write',
    handler: (ctx) =>
      createRateSheet(ctx, {
        providerId: typeof body.providerId === 'string' ? body.providerId : '',
        label: typeof body.label === 'string' ? body.label : '',
        source: typeof body.source === 'string' ? body.source : undefined,
        sourceDocumentId:
          typeof body.sourceDocumentId === 'string' ? body.sourceDocumentId : undefined,
        receivedAt:
          typeof body.receivedAt === 'string' && !Number.isNaN(Date.parse(body.receivedAt))
            ? new Date(body.receivedAt)
            : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
      }),
  });
}
