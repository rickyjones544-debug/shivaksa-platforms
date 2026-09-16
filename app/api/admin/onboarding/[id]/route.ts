import { NextRequest, NextResponse } from 'next/server';
import { withVoipAdminAuth } from '../../../voip/_utils';
import { getKycRecord, reviewKycRecord } from '@/lib/compliance/service';
import { KycRecordStatus } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_DECISIONS = Object.values(KycRecordStatus) as string[];

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    scope: 'admin',
    action: 'read',
    resource: 'organizations',
    handler: async () => {
      const record = await getKycRecord(id);
      if (!record) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: record });
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const body = (await request.json()) as { decision?: KycRecordStatus; reason?: string };
  const decision = body.decision;

  if (!decision || !VALID_DECISIONS.includes(decision)) {
    return NextResponse.json({ success: false, error: 'Invalid decision' }, { status: 400 });
  }

  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    scope: 'admin',
    action: 'write',
    resource: 'organizations',
    handler: async (ctx) => {
      const updated = await reviewKycRecord(ctx, id, decision, body.reason);
      return NextResponse.json({ success: true, data: updated });
    },
  });
}
