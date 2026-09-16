import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/auth';
import { updateKycRecord, submitKycRecord, getKycRecord, canEditKycRecord } from '@/lib/compliance/service';
import type { KycRecordInput, KycDocumentInput } from '@/lib/compliance/service';
import { KycRecordStatus } from '@prisma/client';

export async function GET() {
  try {
    const ctx = await getCurrentUser();
    if (!ctx || !ctx.organization) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const record = await getKycRecord(ctx.organization.id);
    if (!record) {
      return NextResponse.json({ success: true, data: { status: KycRecordStatus.DRAFT, documents: [] } });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load onboarding record';
    console.error('GET /api/onboarding error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getCurrentUser();
    if (!ctx || !ctx.organization) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      data: KycRecordInput;
      documents?: KycDocumentInput[];
      submit?: boolean;
    };

    const existing = await getKycRecord(ctx.organization.id);
    if (existing && !canEditKycRecord(ctx, ctx.organization.id, existing.status)) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record cannot be edited in the current state' },
        { status: 403 }
      );
    }

    if (body.data) {
      await updateKycRecord(ctx, body.data, body.documents);
    }

    if (body.submit) {
      await submitKycRecord(ctx);
    }

    const updated = await getKycRecord(ctx.organization.id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save onboarding record';
    console.error('POST /api/onboarding error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
