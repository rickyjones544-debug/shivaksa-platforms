import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { acceptInvitation, getInvitationByToken } from '@/lib/invitations/service';
import { createSession, setSessionCookie } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, password } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Peek at the invitation to decide whether name/password are required.
    const invitation = await getInvitationByToken(token);
    const existingUser = invitation
      ? await prisma.user.findUnique({ where: { email: invitation.email } })
      : null;

    if (!existingUser && (!name || !password)) {
      return NextResponse.json(
        { success: false, error: 'Name and password are required to create an account' },
        { status: 400 }
      );
    }

    const result = await acceptInvitation(token, { name, password });

    // Create a session for the accepted user in the invited organization.
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: result.user.id,
          organizationId: result.organizationId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Membership not found after accepting invitation' },
        { status: 500 }
      );
    }

    const { token: sessionToken, expiresAt } = await createSession(result.user.id, membership.id);
    await setSessionCookie(sessionToken, expiresAt);

    return NextResponse.json({ success: true, user: result.user, organizationId: result.organizationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('expired') || message.includes('Invalid') ? 400 : 500 }
    );
  }
}
