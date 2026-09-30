import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import type { ProviderRateRouteType, ProviderRateSheetVersionStatus } from '@prisma/client';
import { RateDeskError, orgId, requireOrgSheet } from './rate-sheets';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Rate Desk — internal comparison & history.
//
// Read-only commercial analysis over the immutable version model. The history
// IS the version snapshot — nothing here writes, reconstructs, or rewrites
// rates. The approved/current invariant is strict:
//   ProviderRateSheet.status = ACTIVE  AND  ProviderRateSheetVersion.status = PUBLISHED
// Drafts and superseded/archived rows are never returned as "current". No FX
// conversion, no ranking/recommendation, no carrier-domain reads or writes.
// ============================================================================

const ROUTE_TYPES: readonly ProviderRateRouteType[] = ['FIXED', 'MOBILE', 'BOTH'];
const ISO_4217 = /^[A-Z]{3}$/;
const ISO_COUNTRY = /^[A-Z]{2}$/;
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

export interface CompareRatesInput {
  providerIds?: string[];
  countryIso?: string;
  destination?: string;
  prefix?: string;
  routeType?: string;
  currency?: string;
  effectiveDate?: string;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

export interface ComparisonRateRow {
  id: string;
  provider: { id: string; companyName: string };
  sheet: { id: string; label: string; source: string; receivedAt: Date };
  version: { version: number; status: string; publishedAt: Date | null };
  destination: string | null;
  countryIso: string | null;
  prefix: string;
  routeType: string;
  rate: string;
  currency: string;
  firstIncrementSeconds: number;
  incrementSeconds: number;
  minimumDurationSeconds: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface PaginatedResult<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  /** True when more than one source currency appears in the result set. */
  mixedCurrencies?: boolean;
}

function pageParams(input: { page?: number; pageSize?: number }) {
  const page = Number.isInteger(input.page) && (input.page ?? 0) >= 1 ? input.page! : 1;
  const raw = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageSize =
    Number.isInteger(raw) && raw >= 1 ? Math.min(raw, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function validateFilters(input: CompareRatesInput): {
  countryIso?: string;
  routeType?: ProviderRateRouteType;
  currency?: string;
  effectiveDate?: Date;
} {
  const out: {
    countryIso?: string;
    routeType?: ProviderRateRouteType;
    currency?: string;
    effectiveDate?: Date;
  } = {};

  if (input.countryIso !== undefined && input.countryIso !== '') {
    const iso = input.countryIso.trim().toUpperCase();
    if (!ISO_COUNTRY.test(iso)) {
      throw new RateDeskError('countryIso must be a 2-letter ISO code', 'VALIDATION');
    }
    out.countryIso = iso;
  }
  if (input.routeType !== undefined && input.routeType !== '') {
    const rt = input.routeType.trim().toUpperCase();
    if (!ROUTE_TYPES.includes(rt as ProviderRateRouteType)) {
      throw new RateDeskError(`routeType must be one of ${ROUTE_TYPES.join(', ')}`, 'VALIDATION');
    }
    out.routeType = rt as ProviderRateRouteType;
  }
  if (input.currency !== undefined && input.currency !== '') {
    const cur = input.currency.trim().toUpperCase();
    if (!ISO_4217.test(cur)) {
      throw new RateDeskError('currency must be a 3-letter ISO-4217 code', 'VALIDATION');
    }
    out.currency = cur;
  }
  if (input.effectiveDate !== undefined && input.effectiveDate !== '') {
    const d = new Date(input.effectiveDate);
    if (Number.isNaN(d.getTime())) {
      throw new RateDeskError('effectiveDate is not a valid date', 'VALIDATION');
    }
    out.effectiveDate = d;
  }
  return out;
}

// Rows whose stored prefix lies on the dial-path of the input digits: typing
// "30" matches prefixes "30", "3069", … — a browsing/prefix-tree filter, not a
// longest-prefix routing lookup.
function prefixFilter(prefix?: string): Prisma.ProviderRateWhereInput | Record<string, never> {
  const p = prefix?.trim().replace(/[^\d]/g, '');
  return p ? { prefix: { startsWith: p } } : {};
}

function effectiveDateFilter(d?: Date): Prisma.ProviderRateWhereInput | Record<string, never> {
  if (!d) return {};
  return {
    AND: [
      { effectiveFrom: { lte: d } },
      { OR: [{ effectiveTo: { equals: null } }, { effectiveTo: { gte: d } }] },
    ],
  };
}

type RateWithContext = Prisma.ProviderRateGetPayload<{
  include: {
    provider: { select: { id: true; companyName: true } };
    version: {
      select: {
        version: true;
        status: true;
        publishedAt: true;
        sheet: { select: { id: true; label: true; source: true; receivedAt: true } };
      };
    };
  };
}>;

function toRow(r: RateWithContext): ComparisonRateRow {
  return {
    id: r.id,
    provider: { id: r.provider.id, companyName: r.provider.companyName },
    sheet: {
      id: r.version.sheet.id,
      label: r.version.sheet.label,
      source: r.version.sheet.source,
      receivedAt: r.version.sheet.receivedAt,
    },
    version: {
      version: r.version.version,
      status: r.version.status,
      publishedAt: r.version.publishedAt,
    },
    destination: r.destination,
    countryIso: r.countryIso,
    prefix: r.prefix,
    routeType: r.routeType,
    rate: r.rate.toString(),
    currency: r.currency,
    firstIncrementSeconds: r.firstIncrementSeconds,
    incrementSeconds: r.incrementSeconds,
    minimumDurationSeconds: r.minimumDurationSeconds,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  };
}

const ROW_INCLUDE = {
  provider: { select: { id: true, companyName: true } },
  version: {
    select: {
      version: true,
      status: true,
      publishedAt: true,
      sheet: { select: { id: true, label: true, source: true, receivedAt: true } },
    },
  },
} as const;

// ============================================================================
// compareApprovedRates — only the approved commercial snapshot per sheet:
// sheet ACTIVE + version PUBLISHED. currentVersion alone is NOT sufficient.
// ============================================================================

export async function compareApprovedRates(
  ctx: AuthenticatedContext,
  input: CompareRatesInput
): Promise<PaginatedResult<ComparisonRateRow>> {
  requirePermission(ctx, 'rate-desk', 'read');
  const org = orgId(ctx);
  const f = validateFilters(input);
  const { page, pageSize, skip, take } = pageParams(input);

  const where: Prisma.ProviderRateWhereInput = {
    organizationId: org,
    version: { status: 'PUBLISHED', sheet: { status: 'ACTIVE' } },
    ...(input.providerIds?.length ? { providerId: { in: input.providerIds } } : {}),
    ...(f.countryIso ? { countryIso: f.countryIso } : {}),
    ...(f.routeType ? { routeType: f.routeType } : {}),
    ...(f.currency ? { currency: f.currency } : {}),
    ...(input.destination?.trim()
      ? { destination: { contains: input.destination.trim(), mode: 'insensitive' as const } }
      : {}),
    ...prefixFilter(input.prefix),
    ...effectiveDateFilter(f.effectiveDate),
  };

  const orderBy: Prisma.ProviderRateOrderByWithRelationInput[] =
    input.sortBy === 'rate'
      ? [{ rate: 'asc' }, { prefix: 'asc' }]
      : [{ prefix: 'asc' }, { rate: 'asc' }];

  const [total, rows] = await prisma.$transaction([
    prisma.providerRate.count({ where }),
    prisma.providerRate.findMany({ where, include: ROW_INCLUDE, orderBy, skip, take }),
  ]);

  const mapped = rows.map(toRow);
  return {
    rows: mapped,
    page,
    pageSize,
    total,
    mixedCurrencies: new Set(mapped.map((r) => r.currency)).size > 1,
  };
}

// ============================================================================
// getRateHistory — every snapshot row matching the selector across ALL versions
// of the provider's sheets (DRAFT rows are excluded; history is what was
// submitted/published/superseded, not in-progress edits).
// ============================================================================

export async function getRateHistory(
  ctx: AuthenticatedContext,
  input: {
    providerId?: string;
    sheetId?: string;
    countryIso?: string;
    destination?: string;
    prefix?: string;
    routeType?: string;
    currency?: string;
    effectiveDate?: string;
    versionStatus?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedResult<ComparisonRateRow>> {
  requirePermission(ctx, 'rate-desk', 'read');
  const org = orgId(ctx);
  const f = validateFilters(input);
  const { page, pageSize, skip, take } = pageParams(input);

  let providerId: string | undefined;
  if (input.providerId) {
    const provider = await prisma.provider.findUnique({
      where: { id: input.providerId },
      select: { id: true, organizationId: true },
    });
    if (!provider || provider.organizationId !== org) {
      throw new RateDeskError('Provider not found', 'NOT_FOUND');
    }
    providerId = provider.id;
  }

  if (input.sheetId) {
    await requireOrgSheet(ctx, input.sheetId);
  }

  const versionStatus =
    input.versionStatus !== undefined && input.versionStatus !== ''
      ? input.versionStatus.trim().toUpperCase()
      : undefined;
  if (
    versionStatus !== undefined &&
    !['PUBLISHED', 'SUPERSEDED', 'ARCHIVED'].includes(versionStatus)
  ) {
    // History is snapshot-only: DRAFT is never part of it.
    throw new RateDeskError(
      'versionStatus must be PUBLISHED, SUPERSEDED, or ARCHIVED',
      'VALIDATION'
    );
  }

  const where: Prisma.ProviderRateWhereInput = {
    organizationId: org,
    ...(providerId ? { providerId } : {}),
    version: {
      status: versionStatus
        ? (versionStatus as ProviderRateSheetVersionStatus)
        : { in: ['PUBLISHED', 'SUPERSEDED', 'ARCHIVED'] },
      ...(input.sheetId ? { sheetId: input.sheetId } : {}),
    },
    ...(f.countryIso ? { countryIso: f.countryIso } : {}),
    ...(f.routeType ? { routeType: f.routeType } : {}),
    ...(f.currency ? { currency: f.currency } : {}),
    ...(input.destination?.trim()
      ? { destination: { contains: input.destination.trim(), mode: 'insensitive' as const } }
      : {}),
    ...prefixFilter(input.prefix),
    ...effectiveDateFilter(f.effectiveDate),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.providerRate.count({ where }),
    prisma.providerRate.findMany({
      where,
      include: ROW_INCLUDE,
      orderBy: [{ prefix: 'asc' }, { version: { version: 'desc' } }],
      skip,
      take,
    }),
  ]);

  return { rows: rows.map(toRow), page, pageSize, total };
}
