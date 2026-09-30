import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  createRateSheet,
  listRateSheets,
  getRateSheet,
  createDraftVersion,
  updateDraftRates,
  publishVersion,
  deleteDraftVersion,
  archiveSheet,
  getCurrentRates,
} from '@/lib/rate-desk/services/rate-sheets';
import { validateProviderRateRow, validateProviderRateRows } from '@/lib/rate-desk/validation/rates';
import { getRolePermissions } from '@/lib/rbac/roles';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as Record<string, unknown>,
}));

vi.mock('@/lib/voip/services/audit', () => ({
  audit: vi.fn(async () => {}),
  auditSystem: vi.fn(async () => {}),
}));

// Typed stand-in for the Prisma client: the mock module replaces `prisma` with
// a plain object whose model delegates are vitest fns installed per test.
type MockFn = ReturnType<typeof vi.fn>;
type TxCallback = (tx: typeof prisma) => unknown;

interface PrismaMock {
  provider: { findUnique: MockFn };
  providerRateSheet: {
    create: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
    update: MockFn;
  };
  providerRateSheetVersion: {
    findUnique: MockFn;
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
    updateMany: MockFn;
    delete: MockFn;
  };
  providerRate: {
    deleteMany: MockFn;
    createMany: MockFn;
    findMany: MockFn;
  };
  providerSubmissionDocument: { findUnique: MockFn };
  providerTask: { updateMany: MockFn };
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

const carrierCtx: AuthenticatedContext = {
  ...opsCtx,
  user: { ...opsCtx.user, id: 'u2' },
  role: { id: 'r2', name: 'CARRIER_MANAGER' },
  permissions: getRolePermissions('CARRIER_MANAGER'),
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

const PROVIDER = { id: 'prov-1', organizationId: 'org-1' };
const SHEET = {
  id: 'sheet-1',
  organizationId: 'org-1',
  providerId: 'prov-1',
  label: 'Q3 rates',
  status: 'RECEIVED',
  currentVersion: null,
};

function validRate(overrides: Record<string, unknown> = {}) {
  return {
    prefix: '30',
    routeType: 'FIXED',
    rate: '0.0186',
    currency: 'EUR',
    countryIso: 'GR',
    destination: 'Greece',
    firstIncrementSeconds: 60,
    incrementSeconds: 60,
    minimumDurationSeconds: 60,
    ...overrides,
  };
}

function mockBackend() {
  mockPrisma.provider = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'prov-1' ? PROVIDER : null),
  };
  mockPrisma.providerRateSheet = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'sheet-1',
      ...data,
    })),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'sheet-1' ? SHEET : null),
    findMany: vi.fn(async () => []),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...SHEET,
      ...data,
    })),
  };
  mockPrisma.providerRateSheetVersion = {
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'ver-1',
      ...data,
    })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    updateMany: vi.fn(async () => ({ count: 1 })),
    delete: vi.fn(async () => ({})),
  };
  mockPrisma.providerRate = {
    deleteMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async () => ({ count: 1 })),
    findMany: vi.fn(async () => []),
  };
  mockPrisma.providerSubmissionDocument = {
    findUnique: vi.fn(async () => null),
  };
  mockPrisma.providerTask = {
    updateMany: vi.fn(async () => ({ count: 0 })),
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
// Row validation
// ============================================================================

describe('validateProviderRateRow', () => {
  it('accepts a fully populated valid row', () => {
    const r = validateProviderRateRow(validRate(), 0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.prefix).toBe('30');
      expect(r.data.rate.toString()).toBe('0.0186');
      expect(r.data.currency).toBe('EUR');
      expect(r.data.firstIncrementSeconds).toBe(60);
      expect(r.data.incrementSeconds).toBe(60);
    }
  });

  it('accepts each spec example rate without precision loss', () => {
    for (const value of ['0.0034', '0.0069', '0.0088', '0.0137', '0.0186', '0.0279', '0.0700', '0.1500', '0.2450']) {
      const r = validateProviderRateRow(validRate({ rate: value }), 0);
      expect(r.ok).toBe(true);
      // Decimal value equality — the stored DECIMAL(14,8) preserves the full
      // scale even though toString() normalizes trailing zeros.
      if (r.ok) expect(r.data.rate.equals(value)).toBe(true);
    }
  });

  it('accepts all three route types', () => {
    for (const routeType of ['FIXED', 'MOBILE', 'BOTH']) {
      expect(validateProviderRateRow(validRate({ routeType }), 0).ok).toBe(true);
    }
  });

  it('accepts arbitrary ISO-4217 currency codes beyond USD/EUR', () => {
    for (const currency of ['USD', 'EUR', 'GBP', 'CAD']) {
      expect(validateProviderRateRow(validRate({ currency }), 0).ok).toBe(true);
    }
  });

  it('supports 1/1, 60/60 and 60/1 increment notations', () => {
    for (const [first, inc] of [[1, 1], [60, 60], [60, 1]]) {
      const r = validateProviderRateRow(
        validRate({ firstIncrementSeconds: first, incrementSeconds: inc }),
        0
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.firstIncrementSeconds).toBe(first);
        expect(r.data.incrementSeconds).toBe(inc);
      }
    }
  });

  it('rejects prefix with a leading + or non-digit characters', () => {
    expect(validateProviderRateRow(validRate({ prefix: '+30' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ prefix: '30a' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ prefix: '' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ prefix: '3069123456789012' }), 0).ok).toBe(false);
  });

  it('rejects missing/zero/negative/non-decimal rates', () => {
    expect(validateProviderRateRow({ ...validRate(), rate: undefined }, 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ rate: '0' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ rate: '-0.01' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ rate: 'abc' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ rate: NaN }), 0).ok).toBe(false);
  });

  it('rejects rates with more than 8 decimal places rather than rounding', () => {
    expect(validateProviderRateRow(validRate({ rate: '0.123456789' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ rate: '0.12345678' }), 0).ok).toBe(true);
  });

  it('rejects malformed currency and country ISO', () => {
    expect(validateProviderRateRow(validRate({ currency: 'US' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ currency: 'usd' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ countryIso: 'GRC' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ countryIso: 'gr' }), 0).ok).toBe(false);
  });

  it('rejects unknown fields and invalid route types', () => {
    expect(validateProviderRateRow(validRate({ hack: 1 }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ routeType: 'ALL' }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ routeType: 'both' }), 0).ok).toBe(false);
  });

  it('rejects non-integer increments and negative minimums', () => {
    expect(validateProviderRateRow(validRate({ firstIncrementSeconds: 0 }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ incrementSeconds: 1.5 }), 0).ok).toBe(false);
    expect(validateProviderRateRow(validRate({ minimumDurationSeconds: -1 }), 0).ok).toBe(false);
  });

  it('rejects effectiveTo before effectiveFrom', () => {
    const from = '2026-06-01T00:00:00Z';
    const to = '2026-05-01T00:00:00Z';
    expect(validateProviderRateRow(validRate({ effectiveFrom: from, effectiveTo: to }), 0).ok).toBe(false);
  });

  it('rejects non-array, empty and oversized row sets', () => {
    expect(validateProviderRateRows('x').ok).toBe(false);
    expect(validateProviderRateRows([]).ok).toBe(false);
    expect(validateProviderRateRows([validRate()], 0).ok).toBe(false);
  });
});

// ============================================================================
// Sheet lifecycle
// ============================================================================

describe('createRateSheet', () => {
  it('creates a sheet scoped to the caller org and provider', async () => {
    const sheet = await createRateSheet(opsCtx, { providerId: 'prov-1', label: 'Q3 rates' });
    expect(sheet.organizationId).toBe('org-1');
    expect(sheet.providerId).toBe('prov-1');
  });

  it('rejects a provider from another organization', async () => {
    await expect(
      createRateSheet(opsCtx, { providerId: 'prov-other-org', label: 'x' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects callers without rate-desk:write', async () => {
    await expect(
      createRateSheet(staffCtx, { providerId: 'prov-1', label: 'x' })
    ).rejects.toThrow('Forbidden');
    await expect(
      createRateSheet(clientCtx, { providerId: 'prov-1', label: 'x' })
    ).rejects.toThrow('Forbidden');
  });

  it('rejects invalid source values', async () => {
    await expect(
      createRateSheet(opsCtx, { providerId: 'prov-1', label: 'x', source: 'TELEGRAM' })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects a source document bound to another provider', async () => {
    mockPrisma.providerSubmissionDocument.findUnique = vi.fn(async () => ({
      id: 'doc-1',
      organizationId: 'org-1',
      category: 'RATE_CARD',
      submission: { providerId: 'prov-2', organizationId: 'org-1' },
    }));
    await expect(
      createRateSheet(opsCtx, {
        providerId: 'prov-1',
        label: 'x',
        sourceDocumentId: 'doc-1',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('versions and publication', () => {
  it('creates a draft version with validated rate rows', async () => {
    const version = await createDraftVersion(opsCtx, 'sheet-1', {
      rates: [validRate(), validRate({ prefix: '370', countryIso: 'LT', destination: 'Lithuania' })],
    });
    expect(version.version).toBe(1);
    expect((version as unknown as { rates: { create: unknown[] } }).rates.create).toHaveLength(2);
  });

  it('assigns the next version number after existing versions', async () => {
    mockPrisma.providerRateSheetVersion.findFirst = vi.fn(async () => ({ version: 3 }));
    const version = await createDraftVersion(opsCtx, 'sheet-1', { rates: [validRate()] });
    expect(version.version).toBe(4);
  });

  it('rejects invalid rate rows without creating a version', async () => {
    await expect(
      createDraftVersion(opsCtx, 'sheet-1', { rates: [validRate({ rate: '-1' })] })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(mockPrisma.providerRateSheetVersion.create).not.toHaveBeenCalled();
  });

  it('publishes a draft, supersedes the prior published version, and moves the pointer', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'ver-1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'DRAFT',
      _count: { rates: 5 },
    }));
    await publishVersion(opsCtx, 'sheet-1', 1);

    expect(mockPrisma.providerRateSheetVersion.updateMany).toHaveBeenCalledWith({
      where: { sheetId: 'sheet-1', status: 'PUBLISHED' },
      data: { status: 'SUPERSEDED' },
    });
    expect(mockPrisma.providerRateSheetVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PUBLISHED', publishedById: 'u1' }),
      })
    );
    expect(mockPrisma.providerRateSheet.update).toHaveBeenCalledWith({
      where: { id: 'sheet-1' },
      data: { currentVersion: 1, status: 'ACTIVE' },
    });
  });

  it('refuses to publish a non-DRAFT version or an empty version', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'ver-1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'PUBLISHED',
      _count: { rates: 5 },
    }));
    await expect(publishVersion(opsCtx, 'sheet-1', 1)).rejects.toMatchObject({ code: 'STATE' });

    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'ver-1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'DRAFT',
      _count: { rates: 0 },
    }));
    await expect(publishVersion(opsCtx, 'sheet-1', 1)).rejects.toMatchObject({ code: 'STATE' });
  });

  it('allows draft rate replacement but blocks it after publication', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'ver-1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'DRAFT',
    }));
    await updateDraftRates(opsCtx, 'sheet-1', 1, { rates: [validRate()] });
    expect(mockPrisma.providerRate.deleteMany).toHaveBeenCalled();

    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'ver-1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'PUBLISHED',
    }));
    await expect(
      updateDraftRates(opsCtx, 'sheet-1', 1, { rates: [validRate()] })
    ).rejects.toMatchObject({ code: 'STATE' });
  });

  it('deletes only DRAFT versions, never published history', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'ver-1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'SUPERSEDED',
    }));
    await expect(deleteDraftVersion(opsCtx, 'sheet-1', 1)).rejects.toMatchObject({ code: 'STATE' });

    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'ver-1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'DRAFT',
    }));
    await deleteDraftVersion(opsCtx, 'sheet-1', 1);
    expect(mockPrisma.providerRateSheetVersion.delete).toHaveBeenCalled();
  });

  it('archives a sheet and blocks new versions afterwards', async () => {
    const archived = await archiveSheet(opsCtx, 'sheet-1');
    expect(archived.status).toBe('ARCHIVED');

    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({ ...SHEET, status: 'ARCHIVED' }));
    await expect(
      createDraftVersion(opsCtx, 'sheet-1', { rates: [validRate()] })
    ).rejects.toMatchObject({ code: 'STATE' });
  });
});

// ============================================================================
// Isolation + confidentiality
// ============================================================================

describe('organization isolation and access control', () => {
  it('scopes list and get to the caller organization', async () => {
    await listRateSheets(opsCtx);
    expect(mockPrisma.providerRateSheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) })
    );

    await getRateSheet(opsCtx, 'sheet-1');
    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({
      ...SHEET,
      organizationId: 'org-9',
    }));
    await expect(getRateSheet(opsCtx, 'sheet-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('blocks client roles entirely — providers cannot reach rate-desk data', async () => {
    await expect(listRateSheets(clientCtx)).rejects.toThrow('Forbidden');
    await expect(getRateSheet(clientCtx, 'sheet-1')).rejects.toThrow('Forbidden');
    await expect(getCurrentRates(clientCtx, 'prov-1')).rejects.toThrow('Forbidden');
  });

  it('allows INTERNAL_STAFF read but not write', async () => {
    await listRateSheets(staffCtx);
    await expect(
      createRateSheet(staffCtx, { providerId: 'prov-1', label: 'x' })
    ).rejects.toThrow('Forbidden');
  });

  it('lets CARRIER_MANAGER write/delete drafts (manage wildcard) while read-only staff cannot', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      id: 'v1',
      sheetId: 'sheet-1',
      version: 1,
      status: 'DRAFT',
    }));
    await deleteDraftVersion(carrierCtx, 'sheet-1', 1);
    expect(mockPrisma.providerRateSheetVersion.delete).toHaveBeenCalled();
    await expect(deleteDraftVersion(staffCtx, 'sheet-1', 1)).rejects.toThrow('Forbidden');
  });
});

// ============================================================================
// Isolation from the live carrier domain
// ============================================================================

describe('carrier-domain isolation', () => {
  it('never touches carrierRate, carrier, credential, or route-policy tables', async () => {
    await createRateSheet(opsCtx, { providerId: 'prov-1', label: 'x' });
    await createDraftVersion(opsCtx, 'sheet-1', { rates: [validRate()] });
    const store = prisma as unknown as Record<string, unknown>;
    for (const model of ['carrierRate', 'carrier', 'carrierCredential', 'carrierRoutePolicy']) {
      expect(store[model]).toBeUndefined();
    }
  });
});
