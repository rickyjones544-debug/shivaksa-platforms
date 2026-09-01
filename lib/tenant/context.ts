import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

export type TenantContext = {
  organizationId: string;
  membershipId: string;
  roleId: string;
};

/**
 * Resolve the full authenticated context from a user ID and optional membership ID.
 * If no membershipId is provided, picks the first active membership.
 * Returns null if the user has no active membership and is not a SUPER_ADMIN.
 */
export async function resolveAuthContext(
  userId: string,
  preferredMembershipId?: string
): Promise<AuthenticatedContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
    },
  });

  if (!user) return null;

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: {
      organization: true,
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  let membership: typeof memberships[number] | undefined;

  if (preferredMembershipId) {
    // Require the explicit session membership to be active. Do not silently fall
    // back to another membership to avoid confused-deputy issues after suspension.
    membership = memberships.find((m) => m.id === preferredMembershipId);
  } else {
    membership = memberships[0];
  }

  if (!membership && !user.isSuperAdmin) {
    return null;
  }

  const permissions = membership
    ? membership.role.permissions.map((rp) =>
        rp.permission.resource
          ? `${rp.permission.scope}:${rp.permission.action}:${rp.permission.resource}`
          : `${rp.permission.scope}:${rp.permission.action}`
      )
    : [];

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    },
    membership: membership
      ? {
          id: membership.id,
          organizationId: membership.organizationId,
          roleId: membership.roleId,
          status: membership.status,
        }
      : null,
    organization: membership
      ? {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
        }
      : null,
    role: membership
      ? {
          id: membership.role.id,
          name: membership.role.name,
        }
      : null,
    permissions,
  };
}

/**
 * Extract the tenant context from an authenticated context.
 * Throws if there is no active membership.
 */
export function requireTenant(ctx: AuthenticatedContext): TenantContext {
  if (!ctx.membership) {
    throw new Error('No active organization membership');
  }

  return {
    organizationId: ctx.membership.organizationId,
    membershipId: ctx.membership.id,
    roleId: ctx.membership.roleId,
  };
}
