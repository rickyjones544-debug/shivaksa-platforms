import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, assertTenantOwnership } from '@/lib/tenant/db';
import { audit } from '@/lib/voip/services/audit';

export type OrganizationInput = {
  name: string;
  slug: string;
  status?: string;
};

const ORGANIZATION_STATUSES = new Set(['ACTIVE', 'SUSPENDED']);

function assertOrganizationStatus(status: string) {
  if (!ORGANIZATION_STATUSES.has(status)) {
    throw new Error(`Invalid organization status: ${status}`);
  }
}

function generateSlug(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

export async function listOrganizations(ctx: AuthenticatedContext) {
  if (ctx.user.isSuperAdmin) {
    return prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
  }
  // Non-super-admins see only their active memberships' organizations
  const membershipIds = (
    await prisma.organizationMembership.findMany({
      where: { userId: ctx.user.id, status: 'ACTIVE' },
      select: { organizationId: true },
    })
  ).map((m) => m.organizationId);

  return prisma.organization.findMany({
    where: { id: { in: membershipIds } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createOrganization(ctx: AuthenticatedContext, data: OrganizationInput) {
  if (!data.name?.trim()) {
    throw new Error('Organization name is required');
  }
  if (data.status !== undefined) {
    assertOrganizationStatus(data.status);
  }
  const slug = data.slug?.trim() ? data.slug.trim() : generateSlug(data.name);

  const organization = await prisma.organization.create({
    data: {
      name: data.name.trim(),
      slug,
      status: data.status ?? 'ACTIVE',
    },
  });

  await audit(ctx, 'ORGANIZATION_CREATED', 'Organization', organization.id, {
    name: organization.name,
    status: organization.status,
  });

  return organization;
}

export async function getOrganization(ctx: AuthenticatedContext, id: string) {
  if (ctx.user.isSuperAdmin) {
    // Super admins may operate without an active organization membership; the
    // record itself is the tenant here, so a missing row is the only failure.
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) throw new Error('Organization not found');
    return org;
  }
  const org = await prisma.organization.findFirst({
    where: tenantWhere(ctx, { id }),
  });
  assertTenantOwnership(org, ctx);
  if (!org) throw new Error('Organization not found');
  return org;
}

export async function updateOrganization(
  ctx: AuthenticatedContext,
  id: string,
  data: Partial<OrganizationInput>
) {
  const existing = await getOrganization(ctx, id);

  if (data.status !== undefined) {
    assertOrganizationStatus(data.status);
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      name: data.name ? data.name.trim() : undefined,
      slug: data.slug ? data.slug.trim() : undefined,
      status: data.status,
    },
  });

  await audit(
    ctx,
    data.status && data.status !== existing.status
      ? 'ORGANIZATION_STATUS_CHANGED'
      : 'ORGANIZATION_UPDATED',
    'Organization',
    id,
    { previousStatus: existing.status, status: updated.status, name: updated.name }
  );

  return updated;
}

export async function changeOrganizationStatus(
  ctx: AuthenticatedContext,
  id: string,
  status: string
) {
  const existing = await getOrganization(ctx, id);
  assertOrganizationStatus(status);

  const updated = await prisma.organization.update({
    where: { id },
    data: { status },
  });

  await audit(ctx, 'ORGANIZATION_STATUS_CHANGED', 'Organization', id, {
    previousStatus: existing.status,
    status,
  });

  return updated;
}
