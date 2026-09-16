import { NextRequest, NextResponse } from 'next/server';
import { withVoipAdminAuth } from '../../voip/_utils';
import { getKycRecordsByStatus } from '@/lib/compliance/service';
import { KycRecordStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as KycRecordStatus | null;

  return withVoipAdminAuth(request, {
    scope: 'admin',
    action: 'read',
    resource: 'organizations',
    handler: async (ctx) => {
      if (!ctx.user.isSuperAdmin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const records = status ? await getKycRecordsByStatus(status) : await getKycRecordsByStatus();
      return records.map((record) => ({
        id: record.id,
        organizationId: record.organizationId,
        organizationName: record.organizationName,
        status: record.status,
        submittedAt: record.createdAt,
        updatedAt: record.updatedAt,
        documentCount: record.documentCount,
      }));
    },
  });
}
