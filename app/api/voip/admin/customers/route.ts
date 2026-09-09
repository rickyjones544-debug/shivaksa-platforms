import { NextRequest } from 'next/server';
import { withVoipAdminAuth } from '../../_utils';
import { prisma } from '@/lib/db/prisma';
import { toAdminServiceDto } from '@/lib/voip/dto/admin';

export async function GET(request: NextRequest) {
  return withVoipAdminAuth(request, {
    scope: 'admin',
    action: 'read',
    resource: 'organizations',
    handler: async () => {
      const organizations = await prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          voipService: true,
          wallet: true,
          _count: {
            select: {
              sipAccounts: true,
              phoneNumbers: true,
              voipCalls: true,
            },
          },
        },
      });

      return organizations.map((org) => ({
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
        counts: org._count,
      }));
    },
  });
}
