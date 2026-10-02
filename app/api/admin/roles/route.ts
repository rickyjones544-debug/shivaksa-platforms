import { NextRequest } from 'next/server';
import { withAdminAuth } from '../_utils';
import { prisma } from '@/lib/db/prisma';

// Roles that are safe to assign to customer organization members.
const CLIENT_ASSIGNABLE_ROLES = [
  'CLIENT_ADMIN',
  'CLIENT_VIEWER',
  'CLIENT_VOIP_SUPPORT',
  'SUPERVISOR',
  'BPO_AGENT',
];

export async function GET(request: NextRequest) {
  return withAdminAuth(request, {
    scope: 'membership',
    action: 'read',
    platformOnly: true,
    handler: async () => {
      const roles = await prisma.role.findMany({
        where: { name: { in: CLIENT_ASSIGNABLE_ROLES } },
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
      });
      return roles;
    },
  });
}
