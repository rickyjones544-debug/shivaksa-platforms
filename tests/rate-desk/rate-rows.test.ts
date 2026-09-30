import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  createRateSheet,
  listProvidersForRateDesk,
  listRateCardDocuments,
  addRateRow,
  updateRateRow,
  deleteRateRow,
  createDraftFromCurrentVersion,
} from '@/lib/rate-desk/services/rate-sheets';
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
  provider: { findUnique: MockFn; findMany: MockFn };
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
    create: MockFn;
    findUnique: MockFn;
    update: MockFn;
    delete: MockFn;
    deleteMany: MockFn;
    createMany: MockFn;
  };
  providerSubmissionDocument: { findUnique: MockFn; findMany: MockFn };
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

const PROVIDER = { id: 'prov-1', organizationId: 'org-1' };

const SHEET = {
  id: 'sheet-1',
  organizationId: 'org-1',
  providerId: 'prov-1',
  label: 'Q3 rates',
  status: 'RECEIVED',
  currentVersion: null as number | null,
};

const DRAFT_V1 = { id: 'ver-1', sheetId: 'sheet-1', version: 1, status: 'DRAFT' };
const PUBLISHED_V1 = {
  ...DRAFT_V1,
  status: 'PUBLISHED',
  rates: [
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
      effectiveTo: null,
      notes: 'seeded',
    },
  ],
};

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    prefix: '370',
    routeType: 'MOBILE',
    rate: '0.0234',
    currency: 'USD',
    ...overrides,
  };
}

function mockBackend() {
  mockPrisma.provider = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'prov-1' ? PROVIDER : null),
    findMany: vi.fn(async () => [PROVIDER]),
  };
  mockPrisma.providerRateSheet = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'sheet-1',
      ...data,
    })),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'sheet-1' ? SHEET : null),
    findMany: vi.fn(async () => []),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...SHEET, ...data })),
  };
  mockPrisma.providerRateSheetVersion = {
    findUnique: vi.fn(async () => DRAFT_V1),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'ver-new',
      ...data,
    })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    updateMany: vi.fn(async () => ({ count: 1 })),
    delete: vi.fn(async () => ({})),
  };
  mockPrisma.providerRate = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'rate-1', ...data })),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'rate-1'
        ? { id: 'rate-1', versionId: 'ver-1', organizationId: 'org-1', prefix: '370' }
        : null),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'rate-1',
      ...data,
    })),
    delete: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    createMany: vi.fn(async () => ({ count: 0 })),
  };
  mockPrisma.providerSubmissionDocument = {
    findUnique: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
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
// Sheet creation with initial draft version (§6)
// ============================================================================

describe('createRateSheet initial version', () => {
  it('creates the sheet and DRAFT version 1 atomically, pointer at v1', async () => {
    const sheet = await createRateSheet(opsCtx, { providerId: 'prov-1', label: 'Q3' });
    expect(sheet.currentVersion).toBe(1);
    expect(mockPrisma.providerRateSheetVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sheetId: 'sheet-1', version: 1, status: 'DRAFT' }),
    });
  });

  it('rejects SUBMISSION_DOCUMENT source without a document', async () => {
    await expect(
      createRateSheet(opsCtx, {
        providerId: 'prov-1',
        label: 'x',
        source: 'SUBMISSION_DOCUMENT',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects a document that is not a RATE_CARD', async () => {
    mockPrisma.providerSubmissionDocument.findUnique = vi.fn(async () => ({
      id: 'doc-1',
      organizationId: 'org-1',
      category: 'LICENSE',
      submission: { providerId: 'prov-1', organizationId: 'org-1' },
    }));
    await expect(
      createRateSheet(opsCtx, {
        providerId: 'prov-1',
        label: 'x',
        source: 'SUBMISSION_DOCUMENT',
        sourceDocumentId: 'doc-1',
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a document whose submission is unlinked or belongs to another provider', async () => {
    mockPrisma.providerSubmissionDocument.findUnique = vi.fn(async () => ({
      id: 'doc-2',
      organizationId: 'org-1',
      category: 'RATE_CARD',
      submission: { providerId: null, organizationId: 'org-1' },
    }));
    await expect(
      createRateSheet(opsCtx, {
        providerId: 'prov-1',
        label: 'x',
        source: 'SUBMISSION_DOCUMENT',
        sourceDocumentId: 'doc-2',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('accepts a RATE_CARD document attached to the provider', async () => {
    mockPrisma.providerSubmissionDocument.findUnique = vi.fn(async () => ({
      id: 'doc-3',
      organizationId: 'org-1',
      category: 'RATE_CARD',
      submission: { providerId: 'prov-1', organizationId: 'org-1' },
    }));
    const sheet = await createRateSheet(opsCtx, {
      providerId: 'prov-1',
      label: 'x',
      source: 'SUBMISSION_DOCUMENT',
      sourceDocumentId: 'doc-3',
    });
    expect(sheet.sourceDocumentId).toBe('doc-3');
  });
});

// ============================================================================
// Provider picker + rate-card picker
// ============================================================================

describe('provider and document pickers', () => {
  it('lists only same-org providers', async () => {
    await listProvidersForRateDesk(opsCtx);
    expect(mockPrisma.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    );
  });

  it('denies the pickers to client roles', async () => {
    await expect(listProvidersForRateDesk(clientCtx)).rejects.toThrow('Forbidden');
    await expect(listRateCardDocuments(clientCtx, 'prov-1')).rejects.toThrow('Forbidden');
  });

  it('lists only RATE_CARD docs bound to this provider', async () => {
    await listRateCardDocuments(opsCtx, 'prov-1');
    expect(mockPrisma.providerSubmissionDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          category: 'RATE_CARD',
          submission: { providerId: 'prov-1' },
        }),
      })
    );
  });
});

// ============================================================================
// Row-level draft mutation (§8, §11, §15)
// ============================================================================

describe('draft rate-row mutation', () => {
  it('adds a validated row to a DRAFT version', async () => {
    const row = await addRateRow(opsCtx, 'sheet-1', 1, validRow());
    expect(row.prefix).toBe('370');
    expect(mockPrisma.providerRate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        providerId: 'prov-1',
        versionId: 'ver-1',
      }),
    });
  });

  it('rejects adding to a non-DRAFT version', async () => {
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => PUBLISHED_V1);
    await expect(addRateRow(opsCtx, 'sheet-1', 1, validRow())).rejects.toMatchObject({
      code: 'STATE',
    });
    expect(mockPrisma.providerRate.create).not.toHaveBeenCalled();
  });

  it('rejects invalid rows without writing', async () => {
    await expect(
      addRateRow(opsCtx, 'sheet-1', 1, validRow({ rate: '-1' }))
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(mockPrisma.providerRate.create).not.toHaveBeenCalled();
  });

  it('updates a row only when it belongs to the draft version and org', async () => {
    await updateRateRow(opsCtx, 'sheet-1', 1, 'rate-1', validRow({ rate: '0.0200' }));
    expect(mockPrisma.providerRate.update).toHaveBeenCalled();

    mockPrisma.providerRate.findUnique = vi.fn(async () => ({
      id: 'rate-9',
      versionId: 'other-version',
      organizationId: 'org-1',
    }));
    await expect(
      updateRateRow(opsCtx, 'sheet-1', 1, 'rate-9', validRow())
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects row mutation on published/superseded/archived versions', async () => {
    for (const status of ['PUBLISHED', 'SUPERSEDED', 'ARCHIVED']) {
      mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => ({
        ...DRAFT_V1,
        status,
      }));
      await expect(addRateRow(opsCtx, 'sheet-1', 1, validRow())).rejects.toMatchObject({
        code: 'STATE',
      });
      await expect(deleteRateRow(opsCtx, 'sheet-1', 1, 'rate-1')).rejects.toMatchObject({
        code: 'STATE',
      });
    }
  });

  it('deletes only draft-version rows and verifies row ownership', async () => {
    await deleteRateRow(opsCtx, 'sheet-1', 1, 'rate-1');
    expect(mockPrisma.providerRate.delete).toHaveBeenCalledWith({ where: { id: 'rate-1' } });

    mockPrisma.providerRate.findUnique = vi.fn(async () => null);
    await expect(deleteRateRow(opsCtx, 'sheet-1', 1, 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('denies row mutation to read-only staff and client roles', async () => {
    await expect(addRateRow(staffCtx, 'sheet-1', 1, validRow())).rejects.toThrow('Forbidden');
    await expect(deleteRateRow(clientCtx, 'sheet-1', 1, 'rate-1')).rejects.toThrow('Forbidden');
  });

  it('rejects mutation on another org sheet', async () => {
    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({
      ...SHEET,
      organizationId: 'org-9',
    }));
    await expect(addRateRow(opsCtx, 'sheet-1', 1, validRow())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ============================================================================
// New version from published snapshot (§14)
// ============================================================================

describe('createDraftFromCurrentVersion', () => {
  it('copies published rows into a new draft and moves the pointer', async () => {
    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({
      ...SHEET,
      status: 'ACTIVE',
      currentVersion: 1,
    }));
    mockPrisma.providerRateSheetVersion.findUnique = vi.fn(async () => PUBLISHED_V1);
    mockPrisma.providerRateSheetVersion.findFirst = vi.fn(async () => ({ version: 1 }));

    await createDraftFromCurrentVersion(opsCtx, 'sheet-1');

    const createCall = mockPrisma.providerRateSheetVersion.create.mock.calls[0][0] as {
      data: { version: number; rates: { create: { prefix: string; rate: string }[] } };
    };
    expect(createCall.data.version).toBe(2);
    expect(createCall.data.rates.create).toHaveLength(1);
    expect(createCall.data.rates.create[0].prefix).toBe('30');
    expect(createCall.data.rates.create[0].rate).toBe('0.0186');
    expect(mockPrisma.providerRateSheet.update).toHaveBeenCalledWith({
      where: { id: 'sheet-1' },
      data: { currentVersion: 2 },
    });
  });

  it('creates an empty draft when the sheet has no published version', async () => {
    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({
      ...SHEET,
      currentVersion: null,
    }));
    await createDraftFromCurrentVersion(opsCtx, 'sheet-1');
    const createCall = mockPrisma.providerRateSheetVersion.create.mock.calls[0][0] as {
      data: { rates: { create: unknown[] } };
    };
    expect(createCall.data.rates.create).toHaveLength(0);
  });

  it('refuses to fork from a non-published pointer and from archived sheets', async () => {
    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({
      ...SHEET,
      currentVersion: 1,
    }));
    // pointer at a DRAFT — an unfinished draft already exists
    await expect(createDraftFromCurrentVersion(opsCtx, 'sheet-1')).rejects.toMatchObject({
      code: 'STATE',
    });

    mockPrisma.providerRateSheet.findUnique = vi.fn(async () => ({
      ...SHEET,
      status: 'ARCHIVED',
      currentVersion: 1,
    }));
    await expect(createDraftFromCurrentVersion(opsCtx, 'sheet-1')).rejects.toMatchObject({
      code: 'STATE',
    });
  });

  it('denies version creation to read-only staff', async () => {
    await expect(createDraftFromCurrentVersion(staffCtx, 'sheet-1')).rejects.toThrow('Forbidden');
  });
});
