import { prisma } from '@/lib/db/prisma';
import { audit } from '@/lib/voip/services/audit';
import { hasPermission, requirePermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { validateProviderRateRow, validateProviderRateRows } from '../validation/rates';
import type { ProviderRateSheetSource } from '@prisma/client';

// ============================================================================
// Rate Desk — provider rate sheet service foundation.
//
// ProviderRateSheet / ProviderRateSheetVersion / ProviderRate are internal
// commercial records for rates OFFERED BY an upstream provider to Shivaksa.
// They are structurally isolated from the live carrier domain: this service
// never writes Carrier, CarrierRate, CarrierRoutePolicy, CarrierCredential, or
// any traffic/billing table. Rate activation is a separate explicit action in
// a later phase.
// ============================================================================

export class RateDeskError extends Error {
  constructor(
    message: string,
    readonly code: 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'STATE',
    readonly details?: string[]
  ) {
    super(message);
    this.name = 'RateDeskError';
  }
}

const SHEET_SOURCES: readonly ProviderRateSheetSource[] = [
  'MANUAL',
  'EMAIL',
  'SUBMISSION',
  'SUBMISSION_DOCUMENT',
  'API',
];

// Marker prefix stored in ProviderTask.description to link a rate-sheet review
// task to a specific sheet version. Lets a persisted "under review" state exist
// without a schema change (see lib/rate-desk/services/review.ts).
export const REVIEW_MARKER = 'rate-sheet-review';

export interface CreateRateSheetInput {
  providerId: string;
  label: string;
  source?: string;
  sourceDocumentId?: string;
  receivedAt?: Date;
  notes?: string;
}

export function orgId(ctx: AuthenticatedContext): string {
  const id = ctx.organization?.id ?? ctx.membership?.organizationId;
  if (!id) throw new RateDeskError('No active organization', 'FORBIDDEN');
  return id;
}

async function requireOrgProvider(ctx: AuthenticatedContext, providerId: string) {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { id: true, organizationId: true },
  });
  if (!provider || provider.organizationId !== orgId(ctx)) {
    throw new RateDeskError('Provider not found', 'NOT_FOUND');
  }
  return provider;
}

export async function requireOrgSheet(ctx: AuthenticatedContext, sheetId: string) {
  const sheet = await prisma.providerRateSheet.findUnique({
    where: { id: sheetId },
  });
  if (!sheet || sheet.organizationId !== orgId(ctx)) {
    throw new RateDeskError('Rate sheet not found', 'NOT_FOUND');
  }
  return sheet;
}

// ============================================================================
// Sheets
// ============================================================================

export async function createRateSheet(ctx: AuthenticatedContext, input: CreateRateSheetInput) {
  requirePermission(ctx, 'rate-desk', 'write');

  if (!input.providerId || typeof input.providerId !== 'string') {
    throw new RateDeskError('providerId is required', 'VALIDATION');
  }
  if (!input.label || typeof input.label !== 'string' || input.label.trim().length === 0) {
    throw new RateDeskError('label is required', 'VALIDATION');
  }
  const provider = await requireOrgProvider(ctx, input.providerId);

  let source: ProviderRateSheetSource = 'MANUAL';
  if (input.source !== undefined) {
    if (!SHEET_SOURCES.includes(input.source as ProviderRateSheetSource)) {
      throw new RateDeskError(`source must be one of ${SHEET_SOURCES.join(', ')}`, 'VALIDATION');
    }
    source = input.source as ProviderRateSheetSource;
  }

  // A source document (an uploaded RATE_CARD) must belong to the same org, be
  // the RATE_CARD category, and trace back to a submission already promoted to
  // this provider — never an unattributed or cross-provider document.
  if (input.sourceDocumentId) {
    const doc = await prisma.providerSubmissionDocument.findUnique({
      where: { id: input.sourceDocumentId },
      include: { submission: { select: { providerId: true, organizationId: true } } },
    });
    if (!doc || doc.organizationId !== orgId(ctx) || doc.category !== 'RATE_CARD') {
      throw new RateDeskError('Source document not found', 'NOT_FOUND');
    }
    if (doc.submission?.providerId !== provider.id) {
      throw new RateDeskError('Source document belongs to a different provider', 'FORBIDDEN');
    }
    if (source !== 'SUBMISSION_DOCUMENT') {
      throw new RateDeskError(
        'sourceDocumentId requires source SUBMISSION_DOCUMENT',
        'VALIDATION'
      );
    }
  } else if (source === 'SUBMISSION_DOCUMENT') {
    throw new RateDeskError(
      'SUBMISSION_DOCUMENT source requires sourceDocumentId',
      'VALIDATION'
    );
  }

  // A new sheet is created together with DRAFT Version 1 in one transaction.
  // currentVersion points at the draft until a version is published — it marks
  // the sheet's working pointer; reads that need "the approved snapshot" must
  // additionally require the version to be PUBLISHED (see getCurrentRates).
  const sheet = await prisma.$transaction(async (tx) => {
    const created = await tx.providerRateSheet.create({
      data: {
        organizationId: orgId(ctx),
        providerId: provider.id,
        label: input.label.trim(),
        source,
        sourceDocumentId: input.sourceDocumentId ?? null,
        receivedAt: input.receivedAt ?? new Date(),
        notes: input.notes ?? null,
        createdById: ctx.user.id,
        currentVersion: 1,
      },
    });
    await tx.providerRateSheetVersion.create({
      data: {
        organizationId: orgId(ctx),
        sheetId: created.id,
        version: 1,
        status: 'DRAFT',
      },
    });
    return created;
  });

  await audit(ctx, 'PROVIDER_RATE_SHEET_CREATED', 'provider_rate_sheet', sheet.id, {
    providerId: provider.id,
    label: sheet.label,
    source: sheet.source,
  });
  return sheet;
}

// Provider picker for sheet creation — org-scoped, rate-desk readers only.
export async function listProvidersForRateDesk(ctx: AuthenticatedContext) {
  requirePermission(ctx, 'rate-desk', 'read');
  return prisma.provider.findMany({
    where: { organizationId: orgId(ctx) },
    select: { id: true, companyName: true, lifecycleStage: true, status: true },
    orderBy: { companyName: 'asc' },
  });
}

// Rate-card documents eligible as a sheet's SUBMISSION_DOCUMENT source: only
// documents attached to a submission already linked to this provider. A PENDING
// document cannot be attributed to a provider, so it is never offered.
export async function listRateCardDocuments(ctx: AuthenticatedContext, providerId: string) {
  requirePermission(ctx, 'rate-desk', 'read');
  const provider = await requireOrgProvider(ctx, providerId);
  return prisma.providerSubmissionDocument.findMany({
    where: {
      organizationId: orgId(ctx),
      category: 'RATE_CARD',
      submission: { providerId: provider.id },
    },
    select: {
      id: true,
      originalFileName: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      submissionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listRateSheets(
  ctx: AuthenticatedContext,
  filter?: { providerId?: string; status?: string }
) {
  requirePermission(ctx, 'rate-desk', 'read');
  return prisma.providerRateSheet.findMany({
    where: {
      organizationId: orgId(ctx),
      ...(filter?.providerId ? { providerId: filter.providerId } : {}),
      ...(filter?.status ? { status: filter.status as never } : {}),
    },
    include: {
      provider: { select: { id: true, companyName: true, lifecycleStage: true } },
      versions: { select: { id: true, version: true, status: true, publishedAt: true } },
    },
    orderBy: { receivedAt: 'desc' },
  });
}

export async function getRateSheet(ctx: AuthenticatedContext, sheetId: string) {
  requirePermission(ctx, 'rate-desk', 'read');
  const sheet = await prisma.providerRateSheet.findUnique({
    where: { id: sheetId },
    include: {
      provider: { select: { id: true, companyName: true, lifecycleStage: true } },
      versions: { include: { rates: { orderBy: { prefix: 'asc' } } }, orderBy: { version: 'desc' } },
      sourceDocument: {
        select: { id: true, originalFileName: true, category: true, mimeType: true },
      },
    },
  });
  if (!sheet || sheet.organizationId !== orgId(ctx)) {
    throw new RateDeskError('Rate sheet not found', 'NOT_FOUND');
  }
  return sheet;
}

// ============================================================================
// Versions + rate rows. Versions are immutable once PUBLISHED; history is kept
// by superseding, never by rewriting.
// ============================================================================

export async function createDraftVersion(
  ctx: AuthenticatedContext,
  sheetId: string,
  input: { rates: unknown; notes?: string }
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const sheet = await requireOrgSheet(ctx, sheetId);
  if (sheet.status === 'ARCHIVED') {
    throw new RateDeskError('Cannot add a version to an archived sheet', 'STATE');
  }

  const parsed = validateProviderRateRows(input.rates);
  if (!parsed.ok) {
    throw new RateDeskError('Rate validation failed', 'VALIDATION', parsed.errors);
  }
  const rows = parsed.data;

  const version = await prisma.$transaction(async (tx) => {
    const latest = await tx.providerRateSheetVersion.findFirst({
      where: { sheetId: sheet.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    return tx.providerRateSheetVersion.create({
      data: {
        organizationId: sheet.organizationId,
        sheetId: sheet.id,
        version: nextVersion,
        notes: input.notes ?? null,
        rates: {
          create: rows.map((row) => ({
            organizationId: sheet.organizationId,
            providerId: sheet.providerId,
            ...row,
          })),
        },
      },
      include: { rates: true },
    });
  });

  await audit(ctx, 'PROVIDER_RATE_SHEET_VERSION_CREATED', 'provider_rate_sheet', sheet.id, {
    version: version.version,
    rateCount: rows.length,
  });
  return version;
}

export async function updateDraftRates(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number,
  input: { rates: unknown }
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const { sheet, version } = await requireOrgDraftVersion(ctx, sheetId, versionNumber);

  const parsed = validateProviderRateRows(input.rates);
  if (!parsed.ok) {
    throw new RateDeskError('Rate validation failed', 'VALIDATION', parsed.errors);
  }
  const rows = parsed.data;

  await prisma.$transaction([
    prisma.providerRate.deleteMany({ where: { versionId: version.id } }),
    prisma.providerRate.createMany({
      data: rows.map((row) => ({
        organizationId: sheet.organizationId,
        providerId: sheet.providerId,
        versionId: version.id,
        ...row,
      })),
    }),
  ]);

  await audit(ctx, 'PROVIDER_RATE_SHEET_UPDATED', 'provider_rate_sheet', sheet.id, {
    version: versionNumber,
    rateCount: rows.length,
    action: 'draft_rates_replaced',
  });
}

export async function publishVersion(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const sheet = await requireOrgSheet(ctx, sheetId);
  const version = await prisma.providerRateSheetVersion.findUnique({
    where: { sheetId_version: { sheetId: sheet.id, version: versionNumber } },
    include: { _count: { select: { rates: true } } },
  });
  if (!version) throw new RateDeskError('Version not found', 'NOT_FOUND');
  if (version.status !== 'DRAFT') {
    throw new RateDeskError('Only DRAFT versions can be published', 'STATE');
  }
  if (version._count.rates === 0) {
    throw new RateDeskError('Cannot publish a version with no rates', 'STATE');
  }

  const now = new Date();
  await prisma.$transaction([
    // Supersede the previously published version — history preserved, pointer moves.
    prisma.providerRateSheetVersion.updateMany({
      where: { sheetId: sheet.id, status: 'PUBLISHED' },
      data: { status: 'SUPERSEDED' },
    }),
    prisma.providerRateSheetVersion.update({
      where: { id: version.id },
      data: { status: 'PUBLISHED', publishedAt: now, publishedById: ctx.user.id },
    }),
    prisma.providerRateSheet.update({
      where: { id: sheet.id },
      data: { currentVersion: versionNumber, status: 'ACTIVE' },
    }),
    // Close any open review task for this version — publication completes it.
    prisma.providerTask.updateMany({
      where: {
        providerId: sheet.providerId,
        type: 'RATE_REQUEST',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        description: { startsWith: `${REVIEW_MARKER}:${sheet.id}:${versionNumber}` },
      },
      data: { status: 'DONE' },
    }),
  ]);

  await audit(ctx, 'PROVIDER_RATE_SHEET_VERSION_PUBLISHED', 'provider_rate_sheet', sheet.id, {
    version: versionNumber,
    rateCount: version._count.rates,
  });
}

export async function deleteDraftVersion(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number
) {
  requirePermission(ctx, 'rate-desk', 'delete');
  const sheet = await requireOrgSheet(ctx, sheetId);
  const version = await prisma.providerRateSheetVersion.findUnique({
    where: { sheetId_version: { sheetId: sheet.id, version: versionNumber } },
  });
  if (!version) throw new RateDeskError('Version not found', 'NOT_FOUND');
  if (version.status !== 'DRAFT') {
    throw new RateDeskError('Published or superseded versions cannot be deleted', 'STATE');
  }

  await prisma.providerRateSheetVersion.delete({ where: { id: version.id } });
  await audit(ctx, 'PROVIDER_RATE_SHEET_VERSION_DELETED', 'provider_rate_sheet', sheet.id, {
    version: versionNumber,
  });
}

// ============================================================================
// Row-level draft mutation — the Phase 4B editor path. Every operation resolves
// the version inside the caller's org and hard-fails unless it is DRAFT.
// ============================================================================

export async function requireOrgDraftVersion(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number
) {
  const sheet = await requireOrgSheet(ctx, sheetId);
  const version = await prisma.providerRateSheetVersion.findUnique({
    where: { sheetId_version: { sheetId: sheet.id, version: versionNumber } },
  });
  if (!version) throw new RateDeskError('Version not found', 'NOT_FOUND');
  if (version.status !== 'DRAFT') {
    throw new RateDeskError('Only DRAFT versions can be modified', 'STATE');
  }
  return { sheet, version };
}

export async function addRateRow(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number,
  rawRow: unknown
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const { sheet, version } = await requireOrgDraftVersion(ctx, sheetId, versionNumber);

  const parsed = validateProviderRateRow(rawRow, 0);
  if (!parsed.ok) {
    throw new RateDeskError('Rate validation failed', 'VALIDATION', parsed.errors);
  }

  const row = await prisma.providerRate.create({
    data: {
      organizationId: sheet.organizationId,
      providerId: sheet.providerId,
      versionId: version.id,
      ...parsed.data,
    },
  });
  await audit(ctx, 'PROVIDER_RATE_SHEET_UPDATED', 'provider_rate_sheet', sheet.id, {
    version: versionNumber,
    action: 'rate_row_added',
    prefix: row.prefix,
  });
  return row;
}

export async function updateRateRow(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number,
  rateId: string,
  rawRow: unknown
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const { sheet, version } = await requireOrgDraftVersion(ctx, sheetId, versionNumber);

  const existing = await prisma.providerRate.findUnique({ where: { id: rateId } });
  if (!existing || existing.versionId !== version.id || existing.organizationId !== sheet.organizationId) {
    throw new RateDeskError('Rate row not found', 'NOT_FOUND');
  }

  const parsed = validateProviderRateRow(rawRow, 0);
  if (!parsed.ok) {
    throw new RateDeskError('Rate validation failed', 'VALIDATION', parsed.errors);
  }

  const row = await prisma.providerRate.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  await audit(ctx, 'PROVIDER_RATE_SHEET_UPDATED', 'provider_rate_sheet', sheet.id, {
    version: versionNumber,
    action: 'rate_row_updated',
    rateId: row.id,
    prefix: row.prefix,
  });
  return row;
}

export async function deleteRateRow(
  ctx: AuthenticatedContext,
  sheetId: string,
  versionNumber: number,
  rateId: string
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const { sheet, version } = await requireOrgDraftVersion(ctx, sheetId, versionNumber);

  const existing = await prisma.providerRate.findUnique({ where: { id: rateId } });
  if (!existing || existing.versionId !== version.id || existing.organizationId !== sheet.organizationId) {
    throw new RateDeskError('Rate row not found', 'NOT_FOUND');
  }

  await prisma.providerRate.delete({ where: { id: existing.id } });
  await audit(ctx, 'PROVIDER_RATE_SHEET_UPDATED', 'provider_rate_sheet', sheet.id, {
    version: versionNumber,
    action: 'rate_row_deleted',
    prefix: existing.prefix,
  });
}

// "Create new version" from the detail page: copies the currently published
// version's rows into a fresh DRAFT. With no published version, creates an
// empty draft (publishing an empty version is still rejected downstream).
export async function createDraftFromCurrentVersion(
  ctx: AuthenticatedContext,
  sheetId: string
) {
  requirePermission(ctx, 'rate-desk', 'write');
  const sheet = await requireOrgSheet(ctx, sheetId);
  if (sheet.status === 'ARCHIVED') {
    throw new RateDeskError('Cannot add a version to an archived sheet', 'STATE');
  }

  const result = await prisma.$transaction(async (tx) => {
    const source = sheet.currentVersion
      ? await tx.providerRateSheetVersion.findUnique({
          where: {
            sheetId_version: { sheetId: sheet.id, version: sheet.currentVersion },
          },
          include: { rates: true },
        })
      : null;
    if (source && source.status !== 'PUBLISHED') {
      // An unpublished working draft already occupies the pointer — refuse to
      // fork from it silently.
      throw new RateDeskError('Current version is not published', 'STATE');
    }

    const latest = await tx.providerRateSheetVersion.findFirst({
      where: { sheetId: sheet.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await tx.providerRateSheetVersion.create({
      data: {
        organizationId: sheet.organizationId,
        sheetId: sheet.id,
        version: nextVersion,
        rates: {
          create: (source?.rates ?? []).map((row) => ({
            organizationId: sheet.organizationId,
            providerId: sheet.providerId,
            destination: row.destination,
            countryIso: row.countryIso,
            prefix: row.prefix,
            routeType: row.routeType,
            rate: row.rate,
            currency: row.currency,
            firstIncrementSeconds: row.firstIncrementSeconds,
            incrementSeconds: row.incrementSeconds,
            minimumDurationSeconds: row.minimumDurationSeconds,
            effectiveFrom: row.effectiveFrom,
            effectiveTo: row.effectiveTo,
            notes: row.notes,
          })),
        },
      },
      include: { rates: true },
    });

    await tx.providerRateSheet.update({
      where: { id: sheet.id },
      data: { currentVersion: nextVersion },
    });
    return { version: created, copiedFrom: source?.version ?? null };
  });

  await audit(ctx, 'PROVIDER_RATE_SHEET_VERSION_CREATED', 'provider_rate_sheet', sheet.id, {
    version: result.version.version,
    copiedFrom: result.copiedFrom,
    rateCount: result.version.rates.length,
  });
  return result.version;
}

// ============================================================================
// Sheet lifecycle
// ============================================================================

export async function archiveSheet(ctx: AuthenticatedContext, sheetId: string) {
  requirePermission(ctx, 'rate-desk', 'write');
  const sheet = await requireOrgSheet(ctx, sheetId);
  if (sheet.status === 'ARCHIVED') {
    throw new RateDeskError('Sheet is already archived', 'STATE');
  }
  const updated = await prisma.providerRateSheet.update({
    where: { id: sheet.id },
    data: { status: 'ARCHIVED' },
  });
  await audit(ctx, 'PROVIDER_RATE_SHEET_ARCHIVED', 'provider_rate_sheet', sheet.id, {
    providerId: sheet.providerId,
  });
  return updated;
}

// Read-side helper for the future comparison view: the current published rates
// for one provider, org-scoped. Route selection is NOT part of this phase.
export async function getCurrentRates(ctx: AuthenticatedContext, providerId: string) {
  requirePermission(ctx, 'rate-desk', 'read');
  const provider = await requireOrgProvider(ctx, providerId);
  const sheets = await prisma.providerRateSheet.findMany({
    where: {
      organizationId: orgId(ctx),
      providerId: provider.id,
      status: 'ACTIVE',
      currentVersion: { not: null },
    },
    include: { versions: { where: { status: 'PUBLISHED' }, include: { rates: true } } },
  });
  return sheets
    .flatMap((sheet) => sheet.versions.filter((v) => v.version === sheet.currentVersion))
    .flatMap((version) => version.rates)
    .sort((a, b) => a.prefix.localeCompare(b.prefix) || a.routeType.localeCompare(b.routeType));
}

/** Guard for future phases: rate-desk data must never silently reach routing. */
export function canAccessRateDesk(ctx: AuthenticatedContext): boolean {
  return hasPermission(ctx, 'rate-desk', 'read');
}
