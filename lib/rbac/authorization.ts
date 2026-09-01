import { permissionKey } from './permissions';

export type AuthenticatedContext = {
  user: {
    id: string;
    name: string;
    email: string;
    isSuperAdmin: boolean;
  };
  membership: {
    id: string;
    organizationId: string;
    roleId: string;
    status: string;
  } | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  role: {
    id: string;
    name: string;
  } | null;
  permissions: string[];
};

/**
 * Check if the authenticated context has a specific permission.
 * SUPER_ADMIN bypasses all permission checks.
 */
export function hasPermission(
  ctx: AuthenticatedContext,
  scope: string,
  action: string,
  resource?: string
): boolean {
  if (ctx.user.isSuperAdmin) return true;
  if (ctx.membership?.status !== 'ACTIVE') return false;

  const requested = permissionKey(scope, action, resource);
  const wildcard = permissionKey(scope, action);
  const manageAll = permissionKey(scope, 'manage');

  return (
    ctx.permissions.includes(requested) ||
    ctx.permissions.includes(wildcard) ||
    ctx.permissions.includes(manageAll) ||
    ctx.permissions.includes('*')
  );
}

/**
 * Require a specific permission; throws if missing.
 */
export function requirePermission(
  ctx: AuthenticatedContext,
  scope: string,
  action: string,
  resource?: string
): void {
  if (!hasPermission(ctx, scope, action, resource)) {
    throw new Error('Forbidden');
  }
}

/**
 * Check if the user belongs to the given organization.
 * SUPER_ADMIN is not restricted to one organization but still needs a tenant
 * context for data isolation; this helper checks the active membership.
 */
export function belongsToOrganization(
  ctx: AuthenticatedContext,
  organizationId: string
): boolean {
  if (ctx.user.isSuperAdmin) return true;
  return ctx.membership?.organizationId === organizationId;
}

/**
 * Require an active organization membership.
 */
export function requireActiveMembership(ctx: AuthenticatedContext): void {
  if (!ctx.membership || ctx.membership.status !== 'ACTIVE') {
    throw new Error('No active organization membership');
  }
}
