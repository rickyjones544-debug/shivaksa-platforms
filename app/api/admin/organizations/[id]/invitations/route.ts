import { NextRequest } from 'next/server';
import { withAdminAuth, readBody } from '../../../_utils';
import { listInvitations, createInvitation, type InvitationInput } from '@/lib/invitations/service';
import { sendInvitationEmail } from '@/services/email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withAdminAuth(request, {
    scope: 'invitation',
    action: 'read',
    handler: async (ctx) => listInvitations(ctx, id),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await readBody<InvitationInput>(request);
  return withAdminAuth(request, {
    scope: 'invitation',
    action: 'write',
    handler: async (ctx) => {
      const { invitation, token } = await createInvitation(ctx, id, body);
      const acceptUrl = `${process.env.NEXTAUTH_URL}/register?invitation=${token}`;

      await sendInvitationEmail({
        to: invitation.email,
        organizationName: ctx.organization?.name ?? invitation.organizationId,
        inviterName: ctx.user.name,
        roleName: invitation.role.name,
        acceptUrl,
        expiresAt: invitation.expiresAt,
      });

      return { invitationId: invitation.id, email: invitation.email };
    },
  });
}
