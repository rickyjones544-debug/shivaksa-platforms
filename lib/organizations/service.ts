import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { tenantWhere, assertTenantOwnership } from '@/lib/tenant/db';

export type OrganizationInput = {
  name: string;
  slug: string;
  status?: string;
};

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
  const slug = data.slug?.trim() ? data.slug.trim() : generateSlug(data.name);

  return prisma.organization.create({
    data: {
      name: data.name.trim(),
      slug,
      status: data.status ?? 'ACTIVE',
    },
  });
}

export async function getOrganization(ctx: AuthenticatedContext, id: string) {
  let org: { id: string; name: string; slug: string; status: string; createdAt: Date; updatedAt: Date } | null;
  if (ctx.user.isSuperAdmin) {
    org = await prisma.organization.findUnique({ where: { id } });
  } else {
    org = await prisma.organization.findFirst({
      where: tenantWhere(ctx, { id }),
    });
  }
  assertTenantOwnership(org, ctx);
  return org;
}

export async function updateOrganization(
  ctx: AuthenticatedContext,
  id: string,
  data: Partial<OrganizationInput>
) {
  const existing = await getOrganization(ctx, id);
  assertTenantOwnership(existing, ctx);

  return prisma.organization.update({
    where: { id },
    data: {
      name: data.name ? data.name.trim() : undefined,
      slug: data.slug ? data.slug.trim() : undefined,
      status: data.status,
    },
  });
}

export async function changeOrganizationStatus(
  ctx: AuthenticatedContext,
  id: string,
  status: string
) {
  const existing = await getOrganization(ctx, id);
  assertTenantOwnership(existing, ctx);

  return prisma.organization.update({
    where: { id },
    data: { status },
  });
}
