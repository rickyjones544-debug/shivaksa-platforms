import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, assertTenantOwnership } from '@/lib/tenant/db';
import { generateSessionToken, hashToken } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';

const INVITATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type InvitationInput = {
  email: string;
  roleId: string;
};

export async function listInvitations(ctx: AuthenticatedContext, organizationId: string) {
  await ensureOrganizationAccess(ctx, organizationId);
  return prisma.invitation.findMany({
    where: { organizationId },
    include: { role: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createInvitation(
  ctx: AuthenticatedContext,
  organizationId: string,
  data: InvitationInput
) {
  await ensureOrganizationAccess(ctx, organizationId);

  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_MAX_AGE_MS);

  const invitation = await prisma.invitation.create({
    data: {
      email: data.email.toLowerCase().trim(),
      organizationId,
      roleId: data.roleId,
      tokenHash,
      status: 'PENDING',
      invitedById: ctx.user.id,
      expiresAt,
    },
    include: { role: true },
  });

  return { invitation, token };
}

export async function getInvitationByToken(token: string) {
  const tokenHash = hashToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { organization: true, role: true },
  });

  if (!invitation) return null;
  if (invitation.status !== 'PENDING') return null;
  if (invitation.expiresAt < new Date()) return null;

  return invitation;
}

export async function acceptInvitation(token: string, userData?: { name: string; password: string }) {
  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }

  const email = invitation.email;
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    if (!userData?.name || !userData?.password) {
      throw new Error('Name and password are required to create an account');
    }
    const isFirstUser = (await prisma.user.count()) === 0;
    user = await prisma.user.create({
      data: {
        name: userData.name.trim(),
        email,
        passwordHash: await hashPassword(userData.password),
        status: 'ACTIVE',
        isSuperAdmin: isFirstUser,
      },
    });
  }

  // Create membership if it does not already exist
  const existingMembership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: invitation.organizationId } },
  });

  if (!existingMembership) {
    await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        roleId: invitation.roleId,
        status: 'ACTIVE',
      },
    });
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED', usedAt: new Date() },
  });

  return { user, organizationId: invitation.organizationId };
}

export async function revokeInvitation(ctx: AuthenticatedContext, organizationId: string, invitationId: string) {
  await ensureOrganizationAccess(ctx, organizationId);
  const invitation = await prisma.invitation.findFirst({
    where: tenantWhere(ctx, { id: invitationId }),
  });
  assertTenantOwnership(invitation, ctx, 'Invitation not found');

  return prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'REVOKED' },
  });
}

async function ensureOrganizationAccess(ctx: AuthenticatedContext, organizationId: string) {
  if (ctx.user.isSuperAdmin) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new Error('Organization not found');
    return org;
  }
  const org = await prisma.organization.findFirst({
    where: tenantWhere(ctx, { id: organizationId }),
  });
  assertTenantOwnership(org, ctx);
  return org;
}
