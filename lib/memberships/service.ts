import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { isPlatformOperator } from '@/lib/rbac/authorization';
import { tenantWhere, assertTenantOwnership } from '@/lib/tenant/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { audit } from '@/lib/voip/services/audit';

export type MembershipInput = {
  userId?: string;
  email?: string;
  name?: string;
  password?: string;
  roleId: string;
  status?: string;
};

const MEMBERSHIP_STATUSES = new Set(['PENDING', 'ACTIVE', 'SUSPENDED']);

// Roles that carry platform-wide authority and must never be assigned to a
// customer member by a non-platform caller.
const PLATFORM_ROLE_NAMES = new Set([
  'SUPER_ADMIN',
  'OPERATIONS_MANAGER',
  'QA_MANAGER',
  'INTERNAL_STAFF',
  'CARRIER_MANAGER',
]);

function assertMembershipStatus(status: string) {
  if (!MEMBERSHIP_STATUSES.has(status)) {
    throw new Error(`Invalid membership status: ${status}`);
  }
}

async function assertAssignableRole(ctx: AuthenticatedContext, roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: { select: { key: true } } } } },
  });
  if (!role) throw new Error('Role not found');

  if (isPlatformOperator(ctx)) return role;

  const grantsPlatformAccess =
    PLATFORM_ROLE_NAMES.has(role.name) ||
    role.permissions.some(
      (rp) => rp.permission.key === '*' || rp.permission.key.startsWith('admin:')
    );
  if (grantsPlatformAccess) {
    throw new Error('Forbidden: platform roles cannot be assigned by organization admins');
  }
  return role;
}

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

  const role = await assertAssignableRole(ctx, data.roleId);

  if (data.status !== undefined) {
    assertMembershipStatus(data.status);
  }

  let userId = data.userId;

  if (!userId && data.email && data.password && data.name) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      userId = existing.id;
    } else {
      const strength = validatePasswordStrength(data.password);
      if (!strength.valid) {
        throw new Error(strength.message || 'Password does not meet complexity requirements');
      }
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

  const membership = await prisma.organizationMembership.create({
    data: {
      userId,
      organizationId,
      roleId: role.id,
      status: data.status ?? 'ACTIVE',
    },
  });

  await audit(ctx, 'MEMBERSHIP_CREATED', 'OrganizationMembership', membership.id, {
    organizationId,
    userId,
    roleId: role.id,
    roleName: role.name,
    status: membership.status,
  });

  return membership;
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

  const role = await assertAssignableRole(ctx, roleId);

  const updated = await prisma.organizationMembership.update({
    where: { id: membershipId },
    data: { roleId: role.id },
  });

  await audit(ctx, 'MEMBERSHIP_ROLE_CHANGED', 'OrganizationMembership', membershipId, {
    organizationId,
    userId: membership.userId,
    roleId: role.id,
    roleName: role.name,
  });

  return updated;
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

  assertMembershipStatus(status);

  const updated = await prisma.organizationMembership.update({
    where: { id: membershipId },
    data: { status },
  });

  await audit(ctx, 'MEMBERSHIP_STATUS_CHANGED', 'OrganizationMembership', membershipId, {
    organizationId,
    userId: membership.userId,
    previousStatus: membership.status,
    status,
  });

  return updated;
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
