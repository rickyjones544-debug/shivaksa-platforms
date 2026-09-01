import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { getSessionToken, setSessionMembership } from './session';
import { resolveAuthContext } from '@/lib/tenant/context';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

export type SwitchResult =
  | { success: true; ctx: AuthenticatedContext }
  | { success: false; error: string };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function switchOrganization(organizationId: string): Promise<SwitchResult> {
  const token = await getSessionToken();
  if (!token) {
    return { success: false, error: 'Unauthorized' };
  }

  const session = await prisma.session.findFirst({
    where: { tokenHash: hashToken(token), revoked: false },
    include: { user: true },
  });

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Require an active membership in the requested organization.
  // SUPER_ADMIN does not bypass this; tenant context must always be explicit.
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId: session.userId,
      organizationId,
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    return { success: false, error: 'No active membership in this organization' };
  }

  await setSessionMembership(token, membership.id);

  const ctx = await resolveAuthContext(session.userId, membership.id);
  if (!ctx) {
    return { success: false, error: 'Failed to resolve context' };
  }

  return { success: true, ctx };
}
