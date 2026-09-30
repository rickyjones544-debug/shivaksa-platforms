import { prisma } from '@/lib/db/prisma';
import { audit } from '@/lib/voip/services/audit';
import { requirePermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import {
  RateDeskError,
  REVIEW_MARKER,
  orgId,
  requireOrgDraftVersion,
  requireOrgSheet,
} from './rate-sheets';

// ============================================================================
// Rate Desk — internal review/approval lifecycle.
//
// The version-status enum intentionally has no IN_REVIEW value: "under review"
// is persisted as an open ProviderTask of type RATE_REQUEST whose description
// begins with the REVIEW_MARKER prefix `{marker}:{sheetId}:{version}`. That
// keeps review state durable (a real record with assignee, timestamps, and
// audit trail) using an existing Phase 1 model — no schema change required.
// Publishing a version closes its open review task atomically (rate-sheets.ts).
// ============================================================================

function reviewMarker(sheetId: string, versionNumber: number) {
  return `${REVIEW_MARKER}:${sheetId}:${versionNumber}`;
}

async function findOpenReviewTask(providerId: string, sheetId: string, versionNumber: number) {
  return prisma.providerTask.findFirst({
    where: {
      providerId,
      type: 'RATE_REQUEST',
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      description: { startsWith: reviewMarker(sheetId, versionNumber) },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export interface VersionReviewSummary {
  version: {
    version: number;
    status: string;
    createdAt: Date;
    publishedAt: Date | null;
    notes: string | null;
  };
  /** Derived display state — the version is DRAFT with an open review task. */
  underReview: boolean;
  reviewTask: {
    id: string;
    status: string;
    title: string;
    assigneeId: string | null;
    createdAt: Date;
  } | null;
  rateCount: number;
  routeTypeCounts: Record<string, number>;
  currencyCounts: Record<string, number>;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  hasOpenEndDate: boolean;
  previousPublished: {
    version: number;
    publishedAt: Date | null;
    rateCount: number;
  } | null;
}

// Full review context for the internal review screen: summary distributions,
// effective-date range, open review task, and the prior published snapshot.
export async function getVersionReview(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number
) {
  requirePermission(ctx, 'rate-desk', 'read');
  const sheet = await requireOrgSheet(ctx, sheetId);
  const version = await prisma.providerRateSheetVersion.findUnique({
    where: { sheetId_version: { sheetId: sheet.id, version: versionNumber } },
    include: { rates: { orderBy: [{ countryIso: 'asc' }, { prefix: 'asc' }] } },
  });
  if (!version) throw new RateDeskError('Version not found', 'NOT_FOUND');

  const routeTypeCounts: Record<string, number> = { FIXED: 0, MOBILE: 0, BOTH: 0 };
  const currencyCounts: Record<string, number> = {};
  let effectiveFrom: Date | null = null;
  let effectiveTo: Date | null = null;
  let hasOpenEndDate = false;
  for (const row of version.rates) {
    routeTypeCounts[row.routeType] = (routeTypeCounts[row.routeType] ?? 0) + 1;
    currencyCounts[row.currency] = (currencyCounts[row.currency] ?? 0) + 1;
    if (row.effectiveFrom && (effectiveFrom === null || row.effectiveFrom < effectiveFrom)) {
      effectiveFrom = row.effectiveFrom;
    }
    if (row.effectiveTo === null) hasOpenEndDate = true;
    else if (effectiveTo === null || row.effectiveTo > effectiveTo) effectiveTo = row.effectiveTo;
  }

  const [reviewTask, previousPublished] = await Promise.all([
    findOpenReviewTask(sheet.providerId, sheet.id, versionNumber),
    prisma.providerRateSheetVersion.findFirst({
      where: {
        sheetId: sheet.id,
        version: { lt: versionNumber },
        status: { in: ['PUBLISHED', 'SUPERSEDED'] },
      },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        publishedAt: true,
        _count: { select: { rates: true } },
      },
    }),
  ]);

  const summary: VersionReviewSummary = {
    version: {
      version: version.version,
      status: version.status,
      createdAt: version.createdAt,
      publishedAt: version.publishedAt,
      notes: version.notes,
    },
    underReview: version.status === 'DRAFT' && reviewTask !== null,
    reviewTask: reviewTask
      ? {
          id: reviewTask.id,
          status: reviewTask.status,
          title: reviewTask.title,
          assigneeId: reviewTask.assigneeId,
          createdAt: reviewTask.createdAt,
        }
      : null,
    rateCount: version.rates.length,
    routeTypeCounts,
    currencyCounts,
    effectiveFrom,
    effectiveTo,
    hasOpenEndDate,
    previousPublished: previousPublished
      ? {
          version: previousPublished.version,
          publishedAt: previousPublished.publishedAt,
          rateCount: previousPublished._count.rates,
        }
      : null,
  };

  return { sheet, version, summary };
}

// Submit a DRAFT version for internal review. Creates a durable review record
// (ProviderTask) on the provider; the version stays DRAFT until published.
export async function submitVersionForReview(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const { sheet, version } = await requireOrgDraftVersion(ctx, sheetId, versionNumber);

  const existing = await findOpenReviewTask(sheet.providerId, sheet.id, version.version);
  if (existing) {
    throw new RateDeskError('Version is already under review', 'STATE');
  }

  const task = await prisma.providerTask.create({
    data: {
      providerId: sheet.providerId,
      type: 'RATE_REQUEST',
      status: 'OPEN',
      title: `Review rate sheet "${sheet.label}" v${version.version}`,
      description: reviewMarker(sheet.id, version.version),
      createdById: ctx.user.id,
    },
  });

  await audit(ctx, 'PROVIDER_RATE_SHEET_REVIEW_REQUESTED', 'provider_rate_sheet', sheet.id, {
    version: version.version,
    taskId: task.id,
    organizationId: orgId(ctx),
  });
  return task;
}

// Withdraw a version from review — closes the open review task; the draft
// remains editable. Publishing is the approval path and is unchanged.
export async function cancelVersionReview(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const { sheet, version } = await requireOrgDraftVersion(ctx, sheetId, versionNumber);

  const task = await findOpenReviewTask(sheet.providerId, sheet.id, version.version);
  if (!task) {
    throw new RateDeskError('Version is not under review', 'STATE');
  }

  await prisma.providerTask.update({
    where: { id: task.id },
    data: { status: 'CANCELLED' },
  });
  await audit(ctx, 'PROVIDER_RATE_SHEET_REVIEW_CANCELLED', 'provider_rate_sheet', sheet.id, {
    version: version.version,
    taskId: task.id,
  });
}
