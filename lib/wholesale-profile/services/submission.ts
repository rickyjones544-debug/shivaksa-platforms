import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { audit } from '@/lib/voip/services/audit';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { findOnboardingLinkByToken } from './onboarding-link';
import { getPublishedWholesaleProfile } from './profile';
import { validateProviderSubmission } from '../validation/submission';
import type { ProviderSubmissionPayload } from '../validation/submission';

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly code: 'UNAVAILABLE' | 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'STATE',
    readonly details?: string[]
  ) {
    super(message);
    this.name = 'SubmissionError';
  }
}

// Generic message returned to providers for every access failure — identical
// for invalid, expired, revoked, or exhausted links so the endpoint cannot be
// used to distinguish or enumerate tokens.
const UNAVAILABLE = 'This wholesale partnership link is no longer accepting submissions.';

// ============================================================================
// Provider-facing intake — bearer-token scoped, fail closed.
// Ownership is derived ONLY from the validated onboarding link.
// ============================================================================

export async function submitProviderIntake(
  rawToken: string,
  rawPayload: unknown
): Promise<{ received: true }> {
  const link = await findOnboardingLinkByToken(rawToken);
  if (!link) throw new SubmissionError(UNAVAILABLE, 'UNAVAILABLE');

  // The published provider-safe profile must still resolve — a valid link to a
  // decommissioned profile cannot accept submissions.
  const profile = await getPublishedWholesaleProfile(link.organizationId);
  if (!profile) throw new SubmissionError(UNAVAILABLE, 'UNAVAILABLE');

  const parsed = validateProviderSubmission(rawPayload);
  if (!parsed.ok) {
    throw new SubmissionError('Validation failed', 'VALIDATION', parsed.errors);
  }
  const payload = parsed.data;

  // Atomically claim one submission slot and insert the record in a single
  // transaction. The conditional UPDATE makes the maxSubmissions check
  // race-safe — two concurrent requests cannot both pass it.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.$executeRaw`
      UPDATE onboarding_links
      SET submission_count = submission_count + 1
      WHERE id = ${link.id}
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
        AND (max_submissions IS NULL OR submission_count < max_submissions)
    `;
    if (claimed === 0) {
      throw new SubmissionError(UNAVAILABLE, 'UNAVAILABLE');
    }

    const submission = await tx.providerSubmission.create({
      data: {
        organizationId: link.organizationId,
        onboardingLinkId: link.id,
        providerId: null, // set only by explicit internal promotion
        companyName: payload.company!.companyName,
        website: payload.company?.website ?? null,
        country: payload.company?.country ?? null,
        contactEmail: payload.contacts?.find((c) => c.email)?.email ?? null,
        status: 'NEW',
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    // Claim the documents the provider uploaded against this link — PENDING
    // becomes ATTACHED to this submission snapshot, atomically with intake.
    await tx.providerSubmissionDocument.updateMany({
      where: { onboardingLinkId: link.id, submissionId: null, status: 'PENDING' },
      data: { submissionId: submission.id, status: 'ATTACHED' },
    });
  });

  await audit(null, 'PROVIDER_SUBMISSION_CREATED', 'provider_submission', undefined, {
    organizationId: link.organizationId,
    onboardingLinkId: link.id,
    companyName: payload.company!.companyName,
  });

  // Nothing about the internal record is returned — only acknowledgement.
  return { received: true };
}

// ============================================================================
// Internal review — authenticated, org-scoped, RBAC-gated.
// ============================================================================

function resolveOrgId(ctx: AuthenticatedContext): string {
  const orgId = ctx.organization?.id ?? ctx.membership?.organizationId;
  if (!orgId) throw new SubmissionError('No organization context', 'FORBIDDEN');
  return orgId;
}

function requireSubmissionsPermission(ctx: AuthenticatedContext, action: 'read' | 'write'): void {
  if (!hasPermission(ctx, 'provider', action, 'submissions')) {
    throw new SubmissionError('Forbidden', 'FORBIDDEN');
  }
}

export async function listProviderSubmissions(
  ctx: AuthenticatedContext,
  filter: { status?: string } = {}
) {
  requireSubmissionsPermission(ctx, 'read');
  const organizationId = resolveOrgId(ctx);
  return prisma.providerSubmission.findMany({
    where: { organizationId, ...(filter.status ? { status: filter.status as never } : {}) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyName: true,
      website: true,
      country: true,
      contactEmail: true,
      status: true,
      providerId: true,
      onboardingLinkId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      // payload excluded from list views
    },
  });
}

export async function getProviderSubmission(ctx: AuthenticatedContext, submissionId: string) {
  requireSubmissionsPermission(ctx, 'read');
  const organizationId = resolveOrgId(ctx);

  const submission = await prisma.providerSubmission.findUnique({
    where: { id: submissionId },
    include: {
      documents: {
        select: {
          id: true,
          category: true,
          originalFileName: true,
          mimeType: true,
          sizeBytes: true,
          description: true,
          status: true,
          createdAt: true,
          // storedObjectKey is never returned — retrieval goes through the
          // authorized document endpoint only.
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!submission || submission.organizationId !== organizationId) {
    throw new SubmissionError('Not found', 'NOT_FOUND');
  }

  await audit(ctx, 'PROVIDER_SUBMISSION_VIEWED', 'provider_submission', submission.id, {
    organizationId,
  });

  return submission;
}

// Lifecycle: NEW → REVIEWING → ACCEPTED | REJECTED. ACCEPTED/REJECTED are
// terminal — a finalized submission is never reopened or modified.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ['REVIEWING', 'ACCEPTED', 'REJECTED'],
  REVIEWING: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
};

export async function setProviderSubmissionStatus(
  ctx: AuthenticatedContext,
  submissionId: string,
  status: 'REVIEWING' | 'ACCEPTED' | 'REJECTED',
  reviewNotes?: string
) {
  requireSubmissionsPermission(ctx, 'write');
  const organizationId = resolveOrgId(ctx);

  const submission = await prisma.providerSubmission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.organizationId !== organizationId) {
    throw new SubmissionError('Not found', 'NOT_FOUND');
  }
  if (!ALLOWED_TRANSITIONS[submission.status]?.includes(status)) {
    throw new SubmissionError(`Cannot transition from ${submission.status} to ${status}`, 'STATE');
  }

  const isDecision = status === 'ACCEPTED' || status === 'REJECTED';
  const updated = await prisma.providerSubmission.update({
    where: { id: submission.id },
    data: {
      status,
      reviewedById: isDecision ? ctx.user.id : submission.reviewedById,
      reviewedAt: isDecision ? new Date() : submission.reviewedAt,
      reviewNotes: reviewNotes ?? submission.reviewNotes,
    },
  });

  const action =
    status === 'ACCEPTED'
      ? 'PROVIDER_SUBMISSION_ACCEPTED'
      : status === 'REJECTED'
        ? 'PROVIDER_SUBMISSION_REJECTED'
        : 'PROVIDER_SUBMISSION_STATUS_CHANGED';
  await audit(ctx, action, 'provider_submission', submission.id, {
    organizationId,
    from: submission.status,
    to: status,
  });

  return updated;
}

// ============================================================================
// Promotion — converts an ACCEPTED submission into an internal Provider
// record. This is the ONLY way providerId is set. It never activates
// connectivity, routes, rates, credentials, billing, or traffic.
// ============================================================================

const CONTACT_ROLE_MAP: Record<string, string> = {
  SALES: 'SALES',
  NOC: 'NOC',
  TECHNICAL: 'TECHNICAL',
  BILLING: 'BILLING',
  RATES: 'RATES',
  ACCOUNT: 'ACCOUNT_MANAGER',
  OTHER: 'OTHER',
};

export async function promoteSubmissionToProvider(
  ctx: AuthenticatedContext,
  submissionId: string,
  options: { existingProviderId?: string } = {}
) {
  requireSubmissionsPermission(ctx, 'write');
  const organizationId = resolveOrgId(ctx);

  const submission = await prisma.providerSubmission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.organizationId !== organizationId) {
    throw new SubmissionError('Not found', 'NOT_FOUND');
  }
  if (submission.status !== 'ACCEPTED') {
    throw new SubmissionError('Only ACCEPTED submissions can be promoted', 'STATE');
  }
  if (submission.providerId) {
    throw new SubmissionError('Submission is already linked to a provider', 'STATE');
  }

  let providerId: string;

  if (options.existingProviderId) {
    // Link to an existing internal Provider in the same organization.
    const existing = await prisma.provider.findUnique({ where: { id: options.existingProviderId } });
    if (!existing || existing.organizationId !== organizationId) {
      throw new SubmissionError('Provider not found in this organization', 'NOT_FOUND');
    }
    providerId = existing.id;
  } else {
    // Creating a new Provider record requires provider write permission.
    if (!hasPermission(ctx, 'provider', 'write')) {
      throw new SubmissionError('Forbidden', 'FORBIDDEN');
    }
    const payload = (submission.payload ?? {}) as ProviderSubmissionPayload;
    const provider = await prisma.provider.create({
      data: {
        organizationId,
        companyName: submission.companyName,
        tradingName: payload.company?.legalName ?? null,
        website: submission.website,
        country: submission.country,
        // lifecycleStage defaults to PROSPECT — no activation of any kind.
      },
    });
    providerId = provider.id;
  }

  const payload = (submission.payload ?? {}) as ProviderSubmissionPayload;

  await prisma.$transaction(async (tx) => {
    await tx.providerSubmission.update({
      where: { id: submission.id },
      data: { providerId },
    });

    // Contacts become ProviderContact records only at promotion, from the
    // reviewed submission snapshot — never automatically at intake.
    if (payload.contacts?.length) {
      await tx.providerContact.createMany({
        data: payload.contacts.map((c) => ({
          providerId,
          role: (CONTACT_ROLE_MAP[c.role] ?? 'OTHER') as never,
          name: c.name,
          email: c.email ?? null,
          phone: c.phone ?? null,
          notes: [c.title, c.messaging, c.timezone, c.notes].filter(Boolean).join(' · ') || null,
        })),
      });
    }
  });

  await audit(ctx, 'PROVIDER_SUBMISSION_PROMOTED', 'provider_submission', submission.id, {
    organizationId,
    providerId,
    createdNewProvider: !options.existingProviderId,
  });

  return { providerId };
}
