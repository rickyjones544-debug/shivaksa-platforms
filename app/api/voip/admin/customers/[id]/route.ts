import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../_utils';
import { prisma } from '@/lib/db/prisma';
import { updateVoipService, setAdminSuspension } from '@/lib/voip/services/customers';
import { toAdminServiceDto } from '@/lib/voip/dto/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'admin',
    action: 'read',
    resource: 'organizations',
    handler: async () => {
      const org = await prisma.organization.findUnique({
        where: { id },
        include: { voipService: true, wallet: true },
      });
      if (!org) throw new Error('Not found');
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        service: org.voipService ? toAdminServiceDto(org.voipService) : null,
        wallet: org.wallet
          ? {
              balance: org.wallet.balance.toString(),
              reserved: org.wallet.reserved.toString(),
              available: org.wallet.balance.minus(org.wallet.reserved).toString(),
            }
          : null,
      };
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'manage',
    handler: async (ctx) => {
      const body = await readBody<{
        customerRate?: string | number;
        reserveMinutes?: number;
        maxCallDurationMinutes?: number;
        billingIncrementSeconds?: number;
        minimumBillableSeconds?: number;
        lowBalanceThresholds?: number[];
      }>(request);
      const updated = await updateVoipService(ctx, id, body);
      return toAdminServiceDto(updated);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'manage',
    handler: async (ctx) => {
      const body = await readBody<{ suspended?: boolean }>(request);
      const updated = await setAdminSuspension(ctx, id, body.suspended ?? true);
      return toAdminServiceDto(updated);
    },
  });
}
