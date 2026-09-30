import { prisma } from '@/lib/db/prisma';
import { audit } from '@/lib/voip/services/audit';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import {
  isValidRequirementSectionKey,
  type RequirementSetStatus,
  type RequirementVisibility,
  type RequirementVersionStatus,
} from '../constants';

export class RequirementAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequirementAuthorizationError';
  }
}

export interface CreateRequirementSetInput {
  name: string;
  description?: string;
  organizationId?: string; // SUPER_ADMIN only; non-admin callers are scoped to their active org
  status?: RequirementSetStatus;
}

export interface UpsertRequirementSectionInput {
  key: string;
  title: string;
  description?: string;
  sortOrder?: number;
  visibility?: RequirementVisibility;
  isRequired?: boolean;
  content?: unknown;
}

function requireRequirementPermission(
  ctx: AuthenticatedContext,
  action: 'read' | 'write' | 'delete' | 'manage' | 'publish' | 'archive'
): void {
  if (!hasPermission(ctx, 'requirements', action)) {
    throw new RequirementAuthorizationError(`Missing permission: requirements:${action}`);
  }
}

// Resolve the owning organization. Requirements always belong to exactly one
// Shivaksa organization — never to a provider and never global.
function resolveOrganizationId(ctx: AuthenticatedContext, requestedOrgId?: string): string {
  if (ctx.user.isSuperAdmin && requestedOrgId) return requestedOrgId;
  const orgId = ctx.organization?.id ?? ctx.membership?.organizationId;
  if (!orgId) throw new RequirementAuthorizationError('No organization context');
  return orgId;
}

async function requireRequirementSetInOrg(ctx: AuthenticatedContext, requirementSetId: string) {
  const set = await prisma.requirementSet.findUnique({ where: { id: requirementSetId } });
  if (!set) throw new RequirementAuthorizationError('Requirement set not found');
  if (!ctx.user.isSuperAdmin) {
    const orgId = ctx.organization?.id ?? ctx.membership?.organizationId;
    if (!orgId || set.organizationId !== orgId) {
      throw new RequirementAuthorizationError('Requirement set not found');
    }
  }
  return set;
}

export async function createRequirementSet(
  ctx: AuthenticatedContext,
  input: CreateRequirementSetInput
) {
  requireRequirementPermission(ctx, 'write');
  const organizationId = resolveOrganizationId(ctx, input.organizationId);

  const existing = await prisma.requirementSet.findUnique({
    where: { organizationId_name: { organizationId, name: input.name } },
  });
  if (existing) {
    throw new RequirementAuthorizationError(
      'A requirement set with this name already exists in this organization'
    );
  }

  const set = await prisma.requirementSet.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'DRAFT',
      createdById: ctx.user.id,
      updatedById: ctx.user.id,
    },
  });

  await audit(ctx, 'REQUIREMENT_SET_CREATED', 'requirement_set', set.id, {
    name: set.name,
    organizationId,
  });

  return set;
}

export async function listRequirementSets(ctx: AuthenticatedContext) {
  requireRequirementPermission(ctx, 'read');
  const organizationId = ctx.user.isSuperAdmin
    ? undefined
    : (ctx.organization?.id ?? ctx.membership?.organizationId);
  if (!ctx.user.isSuperAdmin && !organizationId) {
    throw new RequirementAuthorizationError('No organization context');
  }

  return prisma.requirementSet.findMany({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { name: 'asc' },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function upsertRequirementSection(
  ctx: AuthenticatedContext,
  requirementSetId: string,
  input: UpsertRequirementSectionInput
) {
  requireRequirementPermission(ctx, 'write');
  if (!isValidRequirementSectionKey(input.key)) {
    throw new RequirementAuthorizationError(`Invalid section key: ${input.key}`);
  }
  const set = await requireRequirementSetInOrg(ctx, requirementSetId);

  const data = {
    title: input.title,
    description: input.description ?? null,
    sortOrder: input.sortOrder ?? 0,
    visibility: input.visibility ?? 'INTERNAL',
    isRequired: input.isRequired ?? true,
    content: input.content === undefined ? undefined : (input.content as object),
  };

  const section = await prisma.requirementSection.upsert({
    where: {
      requirementSetId_key: { requirementSetId: set.id, key: input.key },
    },
    update: data,
    create: { requirementSetId: set.id, key: input.key, ...data },
  });

  await audit(ctx, 'REQUIREMENT_SECTION_UPDATED', 'requirement_section', section.id, {
    requirementSetId: set.id,
    key: input.key,
  });

  return section;
}

// Creates an immutable version snapshot: copies the live sections of the set
// into RequirementVersionSection rows. Previous versions are never modified.
export async function createRequirementVersion(
  ctx: AuthenticatedContext,
  requirementSetId: string,
  input: { changeSummary?: string } = {}
) {
  requireRequirementPermission(ctx, 'write');
  const set = await requireRequirementSetInOrg(ctx, requirementSetId);

  const sections = await prisma.requirementSection.findMany({
    where: { requirementSetId: set.id },
    orderBy: { sortOrder: 'asc' },
  });

  const aggregate = await prisma.requirementVersion.aggregate({
    where: { requirementSetId: set.id },
    _max: { versionNumber: true },
  });
  const versionNumber = (aggregate._max.versionNumber ?? 0) + 1;

  const version = await prisma.requirementVersion.create({
    data: {
      requirementSetId: set.id,
      versionNumber,
      status: 'DRAFT',
      changeSummary: input.changeSummary ?? null,
      createdById: ctx.user.id,
    },
  });

  if (sections.length > 0) {
    await prisma.requirementVersionSection.createMany({
      data: sections.map((s) => ({
        requirementVersionId: version.id,
        key: s.key,
        title: s.title,
        description: s.description,
        sortOrder: s.sortOrder,
        visibility: s.visibility,
        isRequired: s.isRequired,
        content: s.content ?? undefined,
      })),
    });
  }

  await prisma.requirementSet.update({
    where: { id: set.id },
    data: { currentVersion: versionNumber, updatedById: ctx.user.id },
  });

  await audit(ctx, 'REQUIREMENT_VERSION_CREATED', 'requirement_version', version.id, {
    requirementSetId: set.id,
    versionNumber,
  });

  return prisma.requirementVersion.findUnique({
    where: { id: version.id },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  });
}

// Historical versions remain addressable by (requirementSetId, versionNumber).
export async function getRequirementVersion(
  ctx: AuthenticatedContext,
  requirementSetId: string,
  versionNumber: number
) {
  requireRequirementPermission(ctx, 'read');
  const set = await requireRequirementSetInOrg(ctx, requirementSetId);

  return prisma.requirementVersion.findUnique({
    where: {
      requirementSetId_versionNumber: {
        requirementSetId: set.id,
        versionNumber,
      },
    },
    include: { sections: { orderBy: { sortOrder: 'asc' } } },
  });
}

// Manual lifecycle transitions only. Publishing a version supersedes any other
// published version of the same set; nothing is published externally.
export async function setRequirementVersionStatus(
  ctx: AuthenticatedContext,
  versionId: string,
  status: Extract<RequirementVersionStatus, 'PUBLISHED' | 'ARCHIVED'>
) {
  requireRequirementPermission(ctx, status === 'PUBLISHED' ? 'publish' : 'archive');
  const version = await prisma.requirementVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new RequirementAuthorizationError('Requirement version not found');
  await requireRequirementSetInOrg(ctx, version.requirementSetId);

  const updated = await prisma.requirementVersion.update({
    where: { id: version.id },
    data:
      status === 'PUBLISHED'
        ? { status, publishedAt: new Date(), publishedById: ctx.user.id }
        : { status },
  });

  if (status === 'PUBLISHED') {
    await prisma.requirementVersion.updateMany({
      where: {
        requirementSetId: version.requirementSetId,
        status: 'PUBLISHED',
        id: { not: version.id },
      },
      data: { status: 'SUPERSEDED' },
    });
  }

  await audit(
    ctx,
    status === 'PUBLISHED' ? 'REQUIREMENT_VERSION_PUBLISHED' : 'REQUIREMENT_VERSION_ARCHIVED',
    'requirement_version',
    version.id,
    { requirementSetId: version.requirementSetId, versionNumber: version.versionNumber }
  );

  return updated;
}
