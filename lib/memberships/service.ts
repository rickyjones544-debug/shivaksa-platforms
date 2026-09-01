import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, assertTenantOwnership } from '@/lib/tenant/db';
import { hashPassword } from '@/lib/auth/password';

export type MembershipInput = {
  userId?: string;
  email?: string;
  name?: string;
  password?: string;
  roleId: string;
  status?: string;
};

export async function listMemberships(ctx: AuthenticatedContext, organizationId: string) {
  // Ensure caller can access this organization
  await getOrganizationForAdmin(ctx, organizationId);

  return prisma.organizationMembership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true } }, role: true },
    orderBy: { joinedAt: 'desc' },
  });
}

export async function createMembership(
  ctx: AuthenticatedContext,
  organizationId: string,
  data: MembershipInput
) {
  await getOrganizationForAdmin(ctx, organizationId);

  if (!data.roleId) {
    throw new Error('Role is required');
  }

  let userId = data.userId;

  if (!userId && data.email && data.password && data.name) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      userId = existing.id;
    } else {
      const isFirstUser = (await prisma.user.count()) === 0;
      const created = await prisma.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          passwordHash: await hashPassword(data.password),
          status: 'ACTIVE',
          isSuperAdmin: isFirstUser,
        },
      });
      userId = created.id;
    }
  }

  if (!userId) {
    throw new Error('userId or email+name+password are required');
  }

  return prisma.organizationMembership.create({
    data: {
      userId,
      organizationId,
      roleId: data.roleId,
      status: data.status ?? 'ACTIVE',
    },
  });
}

export async function updateMembershipRole(
  ctx: AuthenticatedContext,
  organizationId: string,
  membershipId: string,
  roleId: string
) {
  await getOrganizationForAdmin(ctx, organizationId);

  const membership = await prisma.organizationMembership.findFirst({
    where: { id: membershipId, organizationId },
  });
  if (!membership) throw new Error('Membership not found');

  return prisma.organizationMembership.update({
    where: { id: membershipId },
    data: { roleId },
  });
}

export async function updateMembershipStatus(
  ctx: AuthenticatedContext,
  organizationId: string,
  membershipId: string,
  status: string
) {
  await getOrganizationForAdmin(ctx, organizationId);

  const membership = await prisma.organizationMembership.findFirst({
    where: { id: membershipId, organizationId },
  });
  if (!membership) throw new Error('Membership not found');

  return prisma.organizationMembership.update({
    where: { id: membershipId },
    data: { status },
  });
}

async function getOrganizationForAdmin(ctx: AuthenticatedContext, organizationId: string) {
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
