import { NextRequest } from 'next/server';
import { withAdminAuth, readBody } from '../../../../_utils';
import { updateMembershipRole } from '@/lib/memberships/service';

interface RouteParams {
  params: Promise<{ id: string; membershipId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, membershipId } = await params;
  const body = await readBody<{ roleId: string }>(request);
  return withAdminAuth(request, {
    scope: 'admin',
    action: 'write',
    resource: 'users',
    handler: async (ctx) => updateMembershipRole(ctx, id, membershipId, body.roleId),
  });
}
