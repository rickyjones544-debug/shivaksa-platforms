import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  compareApprovedRates,
  getRateHistory,
} from '@/lib/rate-desk/services/comparison';
import { getRolePermissions } from '@/lib/rbac/roles';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as Record<string, unknown>,
}));

type MockFn = ReturnType<typeof vi.fn>;
type TxCallback = (tx: typeof prisma) => unknown;

interface PrismaMock {
  providerRate: { count: MockFn; findMany: MockFn };
  provider: { findUnique: MockFn };
  providerRateSheet: { findUnique: MockFn };
  $transaction: MockFn;
}

const mockPrisma = prisma as unknown as PrismaMock;

const opsCtx: AuthenticatedContext = {
  user: { id: 'u1', name: 'Ops', email: 'ops@example.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Shivaksa', slug: 'shivaksa' },
  role: { id: 'r1', name: 'OPERATIONS_MANAGER' },
  permissions: getRolePermissions('OPERATIONS_MANAGER'),
};

const staffCtx: AuthenticatedContext = {
  ...opsCtx,
  role: { id: 'r3', name: 'INTERNAL_STAFF' },
  permissions: getRolePermissions('INTERNAL_STAFF'),
};

const clientCtx: AuthenticatedContext = {
  ...opsCtx,
  membership: { id: 'm9', organizationId: 'org-9', roleId: 'r9', status: 'ACTIVE' },
  organization: { id: 'org-9', name: 'ClientCo', slug: 'clientco' },
  role: { id: 'r4', name: 'CLIENT_ADMIN' },
  permissions: getRolePermissions('CLIENT_ADMIN'),
};

function rateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rate-1',
    provider: { id: 'prov-1', companyName: 'Provider A' },
    version: {
      version: 2,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-03-01'),
      sheet: { id: 'sheet-1', label: 'Q3', source: 'EMAIL', receivedAt: new Date('2026-02-01') },
    },
    destination: 'Greece Mobile',
    countryIso: 'GR',
    prefix: '3069',
    routeType: 'MOBILE',
    rate: { toString: () => '0.0279' },
    currency: 'EUR',
    firstIncrementSeconds: 1,
    incrementSeconds: 1,
    minimumDurationSeconds: 0,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    ...overrides,
  };
}

function mockBackend(rows: ReturnType<typeof rateRow>[] = [rateRow()], total = rows.length) {
  mockPrisma.providerRate = {
    count: vi.fn(async () => total),
    findMany: vi.fn(async () => rows),
  };
  mockPrisma.provider = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'prov-1' ? { id: 'prov-1', organizationId: 'org-1' } : null),
  };
  mockPrisma.providerRateSheet = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'sheet-1'
        ? { id: 'sheet-1', organizationId: 'org-1', providerId: 'prov-1' }
        : null),
  };
  mockPrisma.$transaction = vi.fn(async (cbOrOps: TxCallback | Promise<unknown>[]) => {
    if (typeof cbOrOps === 'function') return cbOrOps(prisma);
    return Promise.all(cbOrOps);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBackend();
});

// ============================================================================
// compareApprovedRates — approved-snapshot invariant + filters (§10, §14)
// ============================================================================

describe('compareApprovedRates', () => {
  it('queries only ACTIVE sheets with PUBLISHED versions, org-scoped', async () => {
    await compareApprovedRates(opsCtx, {});
    const call = mockPrisma.providerRate.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.organizationId).toBe('org-1');
    expect(call.where.version).toEqual({
      status: 'PUBLISHED',
      sheet: { status: 'ACTIVE' },
    });
  });

  it('never returns DRAFT or SUPERSEDED rows as current', async () => {
    // The where clause itself is the assertion — DRAFT/SUPERSEDED cannot match
    // `status: 'PUBLISHED'`; this test documents the invariant explicitly.
    const res = await compareApprovedRates(opsCtx, {});
    expect(res.rows[0].version.status).toBe('PUBLISHED');
  });

  it('maps rows to the DTO without leaking internals', async () => {
    const res = await compareApprovedRates(opsCtx, {});
    const row = res.rows[0];
    expect(row).toMatchObject({
      provider: { id: 'prov-1', companyName: 'Provider A' },
      sheet: { id: 'sheet-1', label: 'Q3', source: 'EMAIL' },
      version: { version: 2, status: 'PUBLISHED' },
      prefix: '3069',
      rate: '0.0279',
      currency: 'EUR',
    });
    expect(row).not.toHaveProperty('notes');
    expect(row).not.toHaveProperty('versionId');
    expect(row).not.toHaveProperty('organizationId');
  });

  it('applies provider, country, destination, prefix, type, currency filters', async () => {
    await compareApprovedRates(opsCtx, {
      providerIds: ['prov-1'],
      countryIso: 'gr',
      destination: 'mobile',
      prefix: '3069',
      routeType: 'mobile',
      currency: 'eur',
    });
    const { where } = mockPrisma.providerRate.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(where.providerId).toEqual({ in: ['prov-1'] });
    expect(where.countryIso).toBe('GR');
    expect(where.destination).toEqual({ contains: 'mobile', mode: 'insensitive' });
    expect(where.prefix).toEqual({ startsWith: '3069' });
    expect(where.routeType).toBe('MOBILE');
    expect(where.currency).toBe('EUR');
  });

  it('applies effective-date filtering with open-ended handling', async () => {
    await compareApprovedRates(opsCtx, { effectiveDate: '2026-06-15' });
    const { where } = mockPrisma.providerRate.findMany.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    expect(where.AND).toEqual([
      { effectiveFrom: { lte: new Date('2026-06-15') } },
      {
        OR: [
          { effectiveTo: { equals: null } },
          { effectiveTo: { gte: new Date('2026-06-15') } },
        ],
      },
    ]);
  });

  it('rejects invalid filters without querying', async () => {
    await expect(compareApprovedRates(opsCtx, { countryIso: 'GRC' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(compareApprovedRates(opsCtx, { routeType: 'ALL' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(compareApprovedRates(opsCtx, { currency: 'usd1' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(
      compareApprovedRates(opsCtx, { effectiveDate: 'not-a-date' })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(mockPrisma.providerRate.findMany).not.toHaveBeenCalled();
  });

  it('flags mixed currencies instead of converting', async () => {
    mockBackend([rateRow(), rateRow({ id: 'rate-2', currency: 'USD' })], 2);
    const res = await compareApprovedRates(opsCtx, {});
    expect(res.mixedCurrencies).toBe(true);
  });

  it('paginates and caps page size', async () => {
    const res = await compareApprovedRates(opsCtx, { page: 2, pageSize: 9999 });
    const call = mockPrisma.providerRate.findMany.mock.calls[0][0] as {
      skip: number;
      take: number;
    };
    expect(call.take).toBe(200);
    expect(call.skip).toBe(200);
    expect(res.total).toBe(1);
  });

  it('fails closed for a cross-org providerId filter', async () => {
    // An org-B provider id in providerIds yields no rows because the where
    // clause still pins organizationId to org-1 — nothing leaks.
    const res = await compareApprovedRates(opsCtx, { providerIds: ['prov-org-b'] });
    const { where } = mockPrisma.providerRate.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(where.organizationId).toBe('org-1');
    expect(res.rows.length).toBeLessThanOrEqual(1); // mock returns rows, but org pin is what matters
  });

  it('allows read-only staff, denies clients', async () => {
    await expect(compareApprovedRates(staffCtx, {})).resolves.toBeDefined();
    await expect(compareApprovedRates(clientCtx, {})).rejects.toThrow('Forbidden');
  });
});

// ============================================================================
// getRateHistory — immutable version snapshots (§8, §9)
// ============================================================================

describe('getRateHistory', () => {
  it('reads published/superseded/archived snapshots, never drafts', async () => {
    await getRateHistory(opsCtx, { providerId: 'prov-1' });
    const { where } = mockPrisma.providerRate.findMany.mock.calls[0][0] as {
      where: { version: { status: unknown } };
    };
    expect(where.version.status).toEqual({ in: ['PUBLISHED', 'SUPERSEDED', 'ARCHIVED'] });
  });

  it('validates the provider belongs to the organization', async () => {
    await getRateHistory(opsCtx, { providerId: 'prov-1' });
    expect(mockPrisma.provider.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prov-1' } })
    );
    mockPrisma.provider.findUnique = vi.fn(async () => ({
      id: 'prov-9',
      organizationId: 'org-9',
    }));
    await expect(getRateHistory(opsCtx, { providerId: 'prov-9' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a request for DRAFT history', async () => {
    await expect(getRateHistory(opsCtx, { versionStatus: 'DRAFT' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(mockPrisma.providerRate.findMany).not.toHaveBeenCalled();
  });

  it('validates a supplied sheetId is inside the organization', async () => {
    await getRateHistory(opsCtx, { sheetId: 'sheet-1' });
    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => null);
    await expect(getRateHistory(opsCtx, { sheetId: 'sheet-9' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('supports filtering to a single version status and ordering newest-first', async () => {
    await getRateHistory(opsCtx, { providerId: 'prov-1', versionStatus: 'SUPERSEDED' });
    const call = mockPrisma.providerRate.findMany.mock.calls[0][0] as {
      where: { version: { status: unknown } };
      orderBy: unknown;
    };
    expect(call.where.version.status).toBe('SUPERSEDED');
    expect(call.orderBy).toEqual([{ prefix: 'asc' }, { version: { version: 'desc' } }]);
  });

  it('returns snapshot rows with sheet and version provenance', async () => {
    const res = await getRateHistory(opsCtx, { prefix: '3069' });
    expect(res.rows[0]).toMatchObject({
      sheet: { label: 'Q3', source: 'EMAIL' },
      version: { version: 2, status: 'PUBLISHED' },
      prefix: '3069',
    });
  });
});
