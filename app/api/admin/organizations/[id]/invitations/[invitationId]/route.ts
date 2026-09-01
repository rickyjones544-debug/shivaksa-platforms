import { NextRequest } from 'next/server';
import { withAdminAuth } from '../../../../_utils';
import { revokeInvitation } from '@/lib/invitations/service';

interface RouteParams {
  params: Promise<{ id: string; invitationId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, invitationId } = await params;
  return withAdminAuth(request, {
    scope: 'admin',
    action: 'write',
    resource: 'users',
    handler: async (ctx) => revokeInvitation(ctx, id, invitationId),
  });
}
