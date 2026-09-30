import { prisma } from '@/lib/db/prisma';
import { audit } from '@/lib/voip/services/audit';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import {
  WholesaleProfileStatus as WholesaleProfileStatusValues,
  type WholesaleProfileStatus,
} from '../constants';

export class WholesaleProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WholesaleProfileError';
  }
}

export interface UpsertWholesaleProfileInput {
  requirementSetId: string;
  title?: string;
  subtitle?: string;
  status?: WholesaleProfileStatus;
  publishedVersionNumber?: number | null;
  organizationId?: string; // SUPER_ADMIN only
}

function requireWholesaleProfilePermission(
  ctx: AuthenticatedContext,
  action: 'read' | 'write' | 'delete' | 'manage' | 'publish' | 'archive'
): void {
  if (!hasPermission(ctx, 'wholesale-profile', action)) {
    throw new WholesaleProfileError(`Missing permission: wholesale-profile:${action}`);
  }
}

function resolveOrganizationId(ctx: AuthenticatedContext, requestedOrgId?: string): string {
  if (ctx.user.isSuperAdmin && requestedOrgId) return requestedOrgId;
  const orgId = ctx.organization?.id ?? ctx.membership?.organizationId;
  if (!orgId) throw new WholesaleProfileError('No organization context');
  return orgId;
}

// ============================================================================
// Provider-safe DTOs — explicit field construction only.
// No raw Prisma objects, no internal IDs, no authorship, no lifecycle metadata.
// These are the ONLY shapes a future provider-facing layer may consume.
// ============================================================================

export interface ProviderRequirementSectionDto {
  key: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isRequired: boolean;
  content: unknown | null;
}

export interface ProviderWholesaleProfileDto {
  title: string;
  subtitle: string | null;
  sections: ProviderRequirementSectionDto[];
}

interface VersionSectionRow {
  key: string;
  title: string;
  description: string | null;
  sortOrder: number;
  visibility: string;
  isRequired: boolean;
  content: unknown;
}

export function toProviderRequirementSectionDto(
  section: VersionSectionRow
): ProviderRequirementSectionDto {
  return {
    key: section.key,
    title: section.title,
    description: section.description,
    sortOrder: section.sortOrder,
    isRequired: section.isRequired,
    content: section.content,
  };
}

export function toProviderWholesaleProfileDto(
  profile: { title: string; subtitle: string | null },
  sections: VersionSectionRow[]
): ProviderWholesaleProfileDto {
  return {
    title: profile.title,
    subtitle: profile.subtitle,
    sections: sections.map(toProviderRequirementSectionDto),
  };
}

// ============================================================================
// Internal management — org-scoped, permission-gated.
// ============================================================================

export async function getActiveWholesaleProfile(ctx: AuthenticatedContext) {
  requireWholesaleProfilePermission(ctx, 'read');
  const organizationId = resolveOrganizationId(ctx);
  return prisma.wholesaleProfile.findUnique({
    where: { organizationId },
    include: { requirementSet: true },
  });
}

export async function upsertWholesaleProfile(
  ctx: AuthenticatedContext,
  input: UpsertWholesaleProfileInput
) {
  requireWholesaleProfilePermission(ctx, 'write');
  const organizationId = resolveOrganizationId(ctx, input.organizationId);

  const set = await prisma.requirementSet.findUnique({
    where: { id: input.requirementSetId },
  });
  if (!set || set.organizationId !== organizationId) {
    throw new WholesaleProfileError('Requirement set not found in this organization');
  }

  // If a published version pointer is set, it must reference an existing
  // PUBLISHED version of this requirement set — never a draft.
  if (input.publishedVersionNumber != null) {
    const version = await prisma.requirementVersion.findUnique({
      where: {
        requirementSetId_versionNumber: {
          requirementSetId: set.id,
          versionNumber: input.publishedVersionNumber,
        },
      },
    });
    if (!version) {
      throw new WholesaleProfileError('Published version does not exist on this requirement set');
    }
    if (version.status !== 'PUBLISHED') {
      throw new WholesaleProfileError('Profile can only point at a PUBLISHED requirement version');
    }
  }

  const profile = await prisma.wholesaleProfile.upsert({
    where: { organizationId },
    update: {
      requirementSetId: input.requirementSetId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      status: input.status,
      publishedVersionNumber: input.publishedVersionNumber ?? null,
      updatedById: ctx.user.id,
    },
    create: {
      organizationId,
      requirementSetId: input.requirementSetId,
      title: input.title ?? 'Wholesale Voice Partnership — Shivaksa Technologies LLC',
      subtitle:
        input.subtitle ??
        'International wholesale termination · carrier relationships · traffic coordination',
      status: input.status ?? 'DRAFT',
      publishedVersionNumber: input.publishedVersionNumber ?? null,
      createdById: ctx.user.id,
      updatedById: ctx.user.id,
    },
  });

  await audit(ctx, 'WHOLESALE_PROFILE_UPDATED', 'wholesale_profile', profile.id, {
    organizationId,
    requirementSetId: input.requirementSetId,
  });

  return profile;
}

// ============================================================================
// Provider-safe resolution — the ONLY function a future token-scoped provider
// layer may call. It takes an organization identifier, never a provider id and
// never a caller-supplied version id.
// ============================================================================

export async function getPublishedWholesaleProfile(
  organizationId: string
): Promise<ProviderWholesaleProfileDto | null> {
  const profile = await prisma.wholesaleProfile.findUnique({
    where: { organizationId },
  });

  // Fail-safe: inactive/archived/absent profile yields nothing.
  if (!profile || profile.status !== WholesaleProfileStatusValues.ACTIVE) {
    return null;
  }
  if (profile.publishedVersionNumber == null) {
    return null;
  }

  // Resolve ONLY the version the profile explicitly points at.
  // Do not use RequirementSet.currentVersion; do not accept external ids.
  const version = await prisma.requirementVersion.findUnique({
    where: {
      requirementSetId_versionNumber: {
        requirementSetId: profile.requirementSetId,
        versionNumber: profile.publishedVersionNumber,
      },
    },
  });
  if (!version || version.status !== 'PUBLISHED') {
    return null;
  }

  // Resolve ONLY the sections belonging to that exact version, and only the
  // PUBLISHABLE ones — INTERNAL sections never leave, even inside a published
  // version.
  const sections = await prisma.requirementVersionSection.findMany({
    where: {
      requirementVersionId: version.id,
      visibility: 'PUBLISHABLE',
    },
    orderBy: { sortOrder: 'asc' },
  });
  if (sections.length === 0) {
    return null;
  }

  return toProviderWholesaleProfileDto(profile, sections);
}
