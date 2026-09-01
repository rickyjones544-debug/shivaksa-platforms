import { NextRequest } from 'next/server';
import { withAdminAuth, readBody } from '../../../../../_utils';
import { updateMembershipStatus } from '@/lib/memberships/service';

interface RouteParams {
  params: Promise<{ id: string; membershipId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, membershipId } = await params;
  const body = await readBody<{ status: string }>(request);
  return withAdminAuth(request, {
    scope: 'admin',
    action: 'write',
    resource: 'users',
    handler: async (ctx) => updateMembershipStatus(ctx, id, membershipId, body.status),
  });
}
