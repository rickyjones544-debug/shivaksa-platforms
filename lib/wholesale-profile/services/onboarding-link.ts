import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { audit } from '@/lib/voip/services/audit';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

export class OnboardingLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnboardingLinkError';
  }
}

export interface CreateOnboardingLinkInput {
  label?: string;
  expiresAt: Date;
  maxSubmissions?: number | null;
  organizationId?: string; // SUPER_ADMIN only
}

export interface ValidatedOnboardingLink {
  id: string;
  organizationId: string;
}

const TOKEN_BYTES = 32; // 32 random bytes → ~256 bits of entropy, base64url-encoded

export function generateOnboardingToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

// The raw token is never stored and never queried — only its SHA-256 hash.
export function hashOnboardingToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function requireLinkPermission(ctx: AuthenticatedContext, resource: 'read' | 'write'): void {
  if (!hasPermission(ctx, 'provider', resource, 'links')) {
    throw new OnboardingLinkError(`Missing permission: provider:${resource}:links`);
  }
}

function resolveOrganizationId(ctx: AuthenticatedContext, requestedOrgId?: string): string {
  if (ctx.user.isSuperAdmin && requestedOrgId) return requestedOrgId;
  const orgId = ctx.organization?.id ?? ctx.membership?.organizationId;
  if (!orgId) throw new OnboardingLinkError('No organization context');
  return orgId;
}

// Internal management — creates a link and returns the raw token ONCE.
// Callers must transmit it immediately; it is never persisted.
export async function createOnboardingLink(
  ctx: AuthenticatedContext,
  input: CreateOnboardingLinkInput
) {
  requireLinkPermission(ctx, 'write');
  const organizationId = resolveOrganizationId(ctx, input.organizationId);

  const token = generateOnboardingToken();
  const link = await prisma.onboardingLink.create({
    data: {
      organizationId,
      tokenHash: hashOnboardingToken(token),
      label: input.label ?? null,
      expiresAt: input.expiresAt,
      maxSubmissions: input.maxSubmissions ?? null,
      createdById: ctx.user.id,
    },
  });

  await audit(ctx, 'ONBOARDING_LINK_CREATED', 'onboarding_link', link.id, {
    organizationId,
    label: input.label ?? null,
    expiresAt: input.expiresAt,
  });

  // The raw token is returned to the creator exactly once; only the hash is stored.
  return { link, token };
}

export async function listOnboardingLinks(ctx: AuthenticatedContext) {
  requireLinkPermission(ctx, 'read');
  const organizationId = resolveOrganizationId(ctx);
  return prisma.onboardingLink.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      expiresAt: true,
      revokedAt: true,
      maxSubmissions: true,
      viewCount: true,
      submissionCount: true,
      lastViewedAt: true,
      createdAt: true,
      // tokenHash intentionally excluded from listings
    },
  });
}

export async function revokeOnboardingLink(ctx: AuthenticatedContext, linkId: string) {
  requireLinkPermission(ctx, 'write');
  const organizationId = resolveOrganizationId(ctx);

  const link = await prisma.onboardingLink.findUnique({ where: { id: linkId } });
  if (!link || link.organizationId !== organizationId) {
    throw new OnboardingLinkError('Onboarding link not found');
  }

  const updated = await prisma.onboardingLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date() },
  });

  await audit(ctx, 'ONBOARDING_LINK_REVOKED', 'onboarding_link', link.id, {
    organizationId,
  });

  return updated;
}

// ============================================================================
// Provider-facing validation — UNAUTHENTICATED, fail-closed.
// Raw token in → SHA-256 → hash lookup → validity checks → link or null.
// Every failure path returns null; callers must not distinguish causes.
// ============================================================================

// Full internal lookup used by token-scoped flows that need link attributes
// (e.g. submission caps). Never exposed to the provider as-is.
export async function findOnboardingLinkByToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  // Reject obviously malformed tokens before hitting the DB.
  if (rawToken.length < 32 || rawToken.length > 256) return null;

  const link = await prisma.onboardingLink.findUnique({
    where: { tokenHash: hashOnboardingToken(rawToken) },
  });

  if (!link) return null;
  if (link.revokedAt) return null;
  if (!link.expiresAt || link.expiresAt.getTime() <= Date.now()) return null;

  return link;
}

export async function validateOnboardingLink(
  rawToken: string
): Promise<ValidatedOnboardingLink | null> {
  const link = await findOnboardingLinkByToken(rawToken);
  if (!link) return null;
  return { id: link.id, organizationId: link.organizationId };
}

// Records a view for a VALID link only. Never touches submissionCount.
// Raw token is never stored, logged, or audited — only the link id.
export async function recordOnboardingView(link: ValidatedOnboardingLink): Promise<void> {
  await prisma.onboardingLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });

  await audit(null, 'ONBOARDING_LINK_VIEWED', 'onboarding_link', link.id, {
    organizationId: link.organizationId,
  });
}
