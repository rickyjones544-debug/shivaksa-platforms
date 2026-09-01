import { Prisma } from '@prisma/client';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

/**
 * Build a Prisma where clause that restricts to the authenticated organization.
 * SUPER_ADMIN still receives the organization scoping to prevent accidental
 * cross-tenant leakage unless an explicit unscoped operation is intended.
 */
export function tenantWhere<T extends Record<string, unknown>>(
  ctx: AuthenticatedContext,
  additional?: T
): { organizationId: string } & T {
  if (!ctx.organization) {
    throw new Error('No active organization');
  }
  return { organizationId: ctx.organization.id, ...(additional ?? ({} as T)) };
}

/**
 * Merge organizationId into create input data.
 */
export function tenantCreateData<T extends Record<string, unknown>>(
  ctx: AuthenticatedContext,
  data: T
): { organizationId: string; createdById: string } & T {
  if (!ctx.organization) {
    throw new Error('No active organization');
  }
  return {
    ...data,
    organizationId: ctx.organization.id,
    createdById: ctx.user.id,
  };
}

/**
 * Assert that an existing record belongs to the authenticated organization.
 * Throws a not-found style error to avoid leaking cross-tenant existence.
 */
export function assertTenantOwnership(
  record: { organizationId: string } | null,
  ctx: AuthenticatedContext,
  message = 'Not found'
): void {
  if (!record) {
    throw new Error(message);
  }
  if (!ctx.organization) {
    throw new Error('No active organization');
  }
  if (record.organizationId !== ctx.organization.id && !ctx.user.isSuperAdmin) {
    throw new Error(message);
  }
}

/**
 * Parse a Prisma Decimal-compatible number/string into a Prisma Decimal input.
 * Returns undefined if value is null/undefined.
 */
export function toDecimalInput(
  value: string | number | null | undefined
): Prisma.Decimal | undefined {
  if (value === null || value === undefined) return undefined;
  return new Prisma.Decimal(value);
}
