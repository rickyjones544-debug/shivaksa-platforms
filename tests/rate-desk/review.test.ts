import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { publishVersion } from '@/lib/rate-desk/services/rate-sheets';
import {
  cancelVersionReview,
  getVersionReview,
  submitVersionForReview,
} from '@/lib/rate-desk/services/review';
import { getRolePermissions } from '@/lib/rbac/roles';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as Record<string, unknown>,
}));

vi.mock('@/lib/voip/services/audit', () => ({
  audit: vi.fn(async () => {}),
  auditSystem: vi.fn(async () => {}),
}));

type MockFn = ReturnType<typeof vi.fn>;
type TxCallback = (tx: typeof prisma) => unknown;

interface PrismaMock {
  providerRateSheet: { findUnique: MockFn; update: MockFn };
  providerRateSheetVersion: {
    findUnique: MockFn;
    findFirst: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  providerTask: {
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
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

const carrierMgrCtx: AuthenticatedContext = {
  ...opsCtx,
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

const SHEET = {
  id: 'sheet-1',
  organizationId: 'org-1',
  providerId: 'prov-1',
  label: 'Q3 rates',
  status: 'RECEIVED',
  currentVersion: 1,
};

const RATES = [
  {
    id: 'r1',
    prefix: '30',
    routeType: 'FIXED',
    rate: '0.0186',
    currency: 'EUR',
    countryIso: 'GR',
    destination: 'Greece',
    firstIncrementSeconds: 60,
    incrementSeconds: 60,
    minimumDurationSeconds: 60,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: new Date('2026-12-31'),
  },
  {
    id: 'r2',
    prefix: '3069',
    routeType: 'MOBILE',
    rate: '0.0279',
    currency: 'EUR',
    countryIso: 'GR',
    destination: 'Greece Mobile',
    firstIncrementSeconds: 1,
    incrementSeconds: 1,
    minimumDurationSeconds: 0,
    effectiveFrom: new Date('2026-02-01'),
    effectiveTo: null,
  },
  {
    id: 'r3',
    prefix: '1',
    routeType: 'BOTH',
    rate: '0.0034',
    currency: 'USD',
    countryIso: 'US',
    destination: 'United States',
    firstIncrementSeconds: 60,
    incrementSeconds: 60,
    minimumDurationSeconds: 0,
    effectiveFrom: new Date('2026-01-15'),
    effectiveTo: null,
  },
];

const DRAFT_V2 = {
  id: 'ver-2',
  sheetId: 'sheet-1',
  version: 2,
  status: 'DRAFT',
  createdAt: new Date('2026-03-01'),
  publishedAt: null,
  notes: null,
  rates: RATES,
};

const OPEN_TASK = {
  id: 'task-1',
  providerId: 'prov-1',
  type: 'RATE_REQUEST',
  status: 'OPEN',
  title: 'Review rate sheet "Q3 rates" v2',
  description: 'rate-sheet-review:sheet-1:2',
  assigneeId: null,
  createdAt: new Date('2026-03-02'),
};

function mockBackend() {
  mockPrisma.providerRateSheet = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'sheet-1' ? SHEET : null),
    update: vi.fn(async () => ({})),
  };
  mockPrisma.providerRateSheetVersion = {
    findUnique: vi.fn(async () => DRAFT_V2),
    findFirst: vi.fn(async () => ({
      version: 1,
      publishedAt: new Date('2026-02-15'),
      _count: { rates: 42 },
    })),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
  mockPrisma.providerTask = {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'task-1',
      ...data,
    })),
    update: vi.fn(async () => ({ ...OPEN_TASK, status: 'CANCELLED' })),
    updateMany: vi.fn(async () => ({ count: 1 })),
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
// Submit for review — DRAFT → REVIEW via ProviderTask marker (no schema change)
// ============================================================================

describe('submitVersionForReview', () => {
  it('creates a RATE_REQUEST review task bound to the sheet version', async () => {
    const task = await submitVersionForReview(opsCtx, 'sheet-1', 2);
    const call = mockPrisma.providerTask.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.providerId).toBe('prov-1');
    expect(call.data.type).toBe('RATE_REQUEST');
    expect(call.data.status).toBe('OPEN');
    expect(call.data.description).toBe('rate-sheet-review:sheet-1:2');
    expect(task.id).toBe('task-1');
  });

  it('rejects a second submission while a review is open', async () => {
    mockPrisma.providerTask.findFirst = vi.fn(async () => OPEN_TASK);
    await expect(submitVersionForReview(opsCtx, 'sheet-1', 2)).rejects.toMatchObject({
      code: 'STATE',
    });
  });

  it('rejects submitting a non-DRAFT version', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      ...DRAFT_V2,
      status: 'PUBLISHED',
    }));
    await expect(submitVersionForReview(opsCtx, 'sheet-1', 2)).rejects.toMatchObject({
      code: 'STATE',
    });
    expect(mockPrisma.providerTask.create).not.toHaveBeenCalled();
  });

  it('denies review submission to read-only staff and client roles', async () => {
    await expect(submitVersionForReview(staffCtx, 'sheet-1', 2)).rejects.toThrow('Forbidden');
    await expect(submitVersionForReview(clientCtx, 'sheet-1', 2)).rejects.toThrow('Forbidden');
  });

  it('returns NOT_FOUND for another organization’s sheet', async () => {
    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({
      ...SHEET,
      organizationId: 'org-9',
    }));
    await expect(submitVersionForReview(opsCtx, 'sheet-1', 2)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ============================================================================
// Cancel review — back to plain DRAFT
// ============================================================================

describe('cancelVersionReview', () => {
  it('cancels the open review task', async () => {
    mockPrisma.providerTask.findFirst = vi.fn(async () => OPEN_TASK);
    await cancelVersionReview(opsCtx, 'sheet-1', 2);
    expect(mockPrisma.providerTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'CANCELLED' },
    });
  });

  it('rejects cancelling when no review is open', async () => {
    await expect(cancelVersionReview(opsCtx, 'sheet-1', 2)).rejects.toMatchObject({
      code: 'STATE',
    });
    expect(mockPrisma.providerTask.update).not.toHaveBeenCalled();
  });

  it('rejects cancelling a non-DRAFT version', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      ...DRAFT_V2,
      status: 'SUPERSEDED',
    }));
    await expect(cancelVersionReview(opsCtx, 'sheet-1', 2)).rejects.toMatchObject({
      code: 'STATE',
    });
  });
});

// ============================================================================
// Review summary — distributions, effective range, previous published context
// ============================================================================

describe('getVersionReview', () => {
  it('computes route-type and currency distribution plus effective range', async () => {
    const { summary } = await getVersionReview(opsCtx, 'sheet-1', 2);
    expect(summary.rateCount).toBe(3);
    expect(summary.routeTypeCounts).toEqual({ FIXED: 1, MOBILE: 1, BOTH: 1 });
    expect(summary.currencyCounts).toEqual({ EUR: 2, USD: 1 });
    expect(summary.effectiveFrom).toEqual(new Date('2026-01-01'));
    expect(summary.effectiveTo).toEqual(new Date('2026-12-31'));
    expect(summary.hasOpenEndDate).toBe(true);
  });

  it('reports the previous published version for context', async () => {
    const { summary } = await getVersionReview(opsCtx, 'sheet-1', 2);
    expect(summary.previousPublished).toEqual({
      version: 1,
      publishedAt: new Date('2026-02-15'),
      rateCount: 42,
    });
  });

  it('marks the version under review only when a DRAFT has an open task', async () => {
    const first = await getVersionReview(opsCtx, 'sheet-1', 2);
    expect(first.summary.underReview).toBe(false);

    mockPrisma.providerTask.findFirst = vi.fn(async () => OPEN_TASK);
    const second = await getVersionReview(opsCtx, 'sheet-1', 2);
    expect(second.summary.underReview).toBe(true);
    expect(second.summary.reviewTask?.status).toBe('OPEN');
  });

  it('allows INTERNAL_STAFF to read the review summary', async () => {
    const { summary } = await getVersionReview(staffCtx, 'sheet-1', 2);
    expect(summary.rateCount).toBe(3);
  });

  it('denies the review summary to client roles', async () => {
    await expect(getVersionReview(clientCtx, 'sheet-1', 2)).rejects.toThrow('Forbidden');
  });
});

// ============================================================================
// Publishing closes the open review task atomically (§12 lifecycle)
// ============================================================================

describe('publishVersion review integration', () => {
  it('closes open review tasks for the published version in the same tx', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      ...DRAFT_V2,
      _count: { rates: 3 },
    }));
    await publishVersion(opsCtx, 'sheet-1', 2);
    expect(mockPrisma.providerTask.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        providerId: 'prov-1',
        type: 'RATE_REQUEST',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        description: { startsWith: 'rate-sheet-review:sheet-1:2' },
      }),
      data: { status: 'DONE' },
    });
  });

  it('publishing remains server-authorized: staff cannot publish', async () => {
    await expect(publishVersion(staffCtx, 'sheet-1', 2)).rejects.toThrow('Forbidden');
  });

  it('CARRIER_MANAGER retains publish per existing RBAC', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
      ...DRAFT_V2,
      _count: { rates: 3 },
    }));
    await expect(publishVersion(carrierMgrCtx, 'sheet-1', 2)).resolves.toBeUndefined();
  });
});
