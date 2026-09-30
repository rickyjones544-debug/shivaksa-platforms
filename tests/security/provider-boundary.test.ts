import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import {
  findOnboardingLinkByToken,
  validateOnboardingLink,
} from '@/lib/wholesale-profile/services/onboarding-link';
import { getPublishedWholesaleProfile } from '@/lib/wholesale-profile/services/profile';
import { submitProviderIntake } from '@/lib/wholesale-profile/services/submission';
import { uploadProviderDocument, getSubmissionDocument } from '@/lib/wholesale-profile/services/documents';
import { getRolePermissions } from '@/lib/rbac/roles';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as Record<string, unknown>,
}));

vi.mock('@/lib/voip/services/audit', () => ({
  audit: vi.fn(async () => {}),
  auditSystem: vi.fn(async () => {}),
}));

vi.mock('@/lib/storage', () => ({
  putPrivateObject: vi.fn(async () => {}),
  getPrivateObject: vi.fn(async () => Buffer.from('file')),
}));

type MockFn = ReturnType<typeof vi.fn>;
type TxCallback = (tx: typeof prisma) => unknown;

interface PrismaMock {
  onboardingLink: { findUnique: MockFn; update: MockFn };
  wholesaleProfile: { findUnique: MockFn };
  requirementVersion: { findUnique: MockFn };
  requirementVersionSection: { findMany: MockFn };
  providerSubmission: { findUnique: MockFn; create: MockFn };
  providerSubmissionDocument: {
    count: MockFn;
    create: MockFn;
    findUnique: MockFn;
    updateMany: MockFn;
  };
  providerTask: {
    findFirst: MockFn;
    findMany: MockFn;
    create: MockFn;
    update: MockFn;
    updateMany: MockFn;
    count: MockFn;
  };
  providerRate: { findMany: MockFn; count: MockFn };
  providerRateSheet: { findMany: MockFn; findUnique: MockFn };
  providerRateSheetVersion: { findFirst: MockFn; findUnique: MockFn };
  provider: { findUnique: MockFn; findMany: MockFn };
  $transaction: MockFn;
  $executeRaw: MockFn;
}

const mockPrisma = prisma as unknown as PrismaMock;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'vt_' + 'a'.repeat(40);

const LINK = {
  id: 'ol1',
  organizationId: 'org-1',
  tokenHash: sha256(TOKEN),
  expiresAt: new Date(Date.now() + 86400_000),
  revokedAt: null,
  maxSubmissions: 3,
  submissionCount: 0,
};

const opsCtx: AuthenticatedContext = {
  user: { id: 'u1', name: 'Ops', email: 'ops@example.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Shivaksa', slug: 'shivaksa' },
  role: { id: 'r1', name: 'OPERATIONS_MANAGER' },
  permissions: getRolePermissions('OPERATIONS_MANAGER'),
};

function installTrap() {
  // Every providerTask delegate throws — provider-facing code must never call it.
  const trap = vi.fn(async () => {
    throw new Error('providerTask must never be queried by provider-facing paths');
  });
  mockPrisma.providerTask = {
    findFirst: trap,
    findMany: trap,
    create: trap,
    update: trap,
    updateMany: trap,
    count: trap,
  };
  return trap;
}

function mockProviderFacingBackend() {
  mockPrisma.onboardingLink = {
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === LINK.tokenHash ? LINK : null),
    update: vi.fn(async () => LINK),
  };
  mockPrisma.wholesaleProfile = {
    findUnique: vi.fn(async () => ({
      id: 'wp1',
      organizationId: 'org-1',
      requirementSetId: 'rs1',
      publishedVersionNumber: 1,
      status: 'ACTIVE',
      title: 'Wholesale profile',
      subtitle: null,
      updatedById: 'u9',
    })),
  };
  mockPrisma.requirementVersion = {
    findUnique: vi.fn(async () => ({
      id: 'rv1',
      status: 'PUBLISHED',
      createdById: 'u9',
    })),
  };
  mockPrisma.requirementVersionSection = {
    findMany: vi.fn(async () => [
      {
        id: 's1',
        key: 'COMPANY_PROFILE',
        title: 'Company',
        description: null,
        sortOrder: 1,
        visibility: 'PUBLISHABLE',
        isRequired: true,
        content: {},
      },
    ]),
  };
  mockPrisma.providerSubmission = {
    findUnique: vi.fn(async () => null),
    create: vi.fn(async () => ({ id: 'ps1' })),
  };
  mockPrisma.providerSubmissionDocument = {
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'doc-1',
      ...data,
    })),
    findUnique: vi.fn(async () => null),
    updateMany: vi.fn(async () => ({ count: 0 })),
  };
  mockPrisma.provider = {
    findUnique: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
  };
  mockPrisma.providerRate = { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) };
  mockPrisma.providerRateSheet = {
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => null),
  };
  mockPrisma.providerRateSheetVersion = {
    findFirst: vi.fn(async () => null),
    findUnique: vi.fn(async () => null),
  };
  mockPrisma.$executeRaw = vi.fn(async () => 1); // conditional UPDATE claims a submission slot
  mockPrisma.$transaction = vi.fn(async (cbOrOps: TxCallback | Promise<unknown>[]) => {
    if (typeof cbOrOps === 'function') return cbOrOps(prisma);
    return Promise.all(cbOrOps);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProviderFacingBackend();
});

// ============================================================================
// §6 — Internal Rate Desk review tasks must never reach provider-facing flows.
// The ProviderTask delegate is a throwing trap: any call fails the test.
// ============================================================================

describe('ProviderTask boundary — provider-facing flows', () => {
  it('token validation + profile resolution never touches providerTask', async () => {
    const trap = installTrap();
    const link = await findOnboardingLinkByToken(TOKEN);
    expect(link?.id).toBe('ol1');
    const scoped = await validateOnboardingLink(TOKEN);
    expect(scoped).toEqual({ id: 'ol1', organizationId: 'org-1' });
    const profile = await getPublishedWholesaleProfile('org-1');
    expect(profile?.title).toBe('Wholesale profile');
    expect(trap).not.toHaveBeenCalled();
  });

  it('provider submission intake never touches providerTask', async () => {
    const trap = installTrap();
    await expect(
      submitProviderIntake(TOKEN, { company: { companyName: 'Acme' } })
    ).resolves.toEqual({ received: true });
    expect(trap).not.toHaveBeenCalled();
  });

  it('provider document upload never touches providerTask', async () => {
    const trap = installTrap();
    await expect(
      uploadProviderDocument(TOKEN, {
        category: 'COMPANY_DOCUMENT',
        fileName: 'license.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fake'),
      })
    ).resolves.toMatchObject({ id: 'doc-1', category: 'COMPANY_DOCUMENT' });
    expect(trap).not.toHaveBeenCalled();
  });

  it('provider-facing DTOs expose no internal identifiers or task data', async () => {
    installTrap();
    const profile = await getPublishedWholesaleProfile('org-1');
    const json = JSON.stringify(profile);
    for (const forbidden of [
      'organizationId',
      'updatedById',
      'createdById',
      'publishedVersionNumber',
      'requirementSetId',
      'rate-sheet-review',
      'providerTask',
      'ProviderRate',
    ]) {
      expect(json).not.toContain(forbidden);
    }
    const doc = await uploadProviderDocument(TOKEN, {
      category: 'RATE_CARD',
      fileName: 'card.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fake'),
    });
    expect(doc).not.toHaveProperty('storedObjectKey');
    expect(doc).not.toHaveProperty('organizationId');
    expect(doc).not.toHaveProperty('onboardingLinkId');
  });
});

// ============================================================================
// §8 — Cross-organization document/submission retrieval fails closed.
// ============================================================================

describe('cross-organization document isolation', () => {
  it('rejects a submission owned by another organization', async () => {
    mockPrisma.providerSubmission.findUnique = vi.fn(async () => ({
      id: 'ps-9',
      organizationId: 'org-9',
    }));
    await expect(getSubmissionDocument(opsCtx, 'ps-9', 'doc-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a document not attached to the claimed submission', async () => {
    mockPrisma.providerSubmission.findUnique = vi.fn(async () => ({
      id: 'ps-1',
      organizationId: 'org-1',
    }));
    mockPrisma.providerSubmissionDocument.findUnique = vi.fn(async () => ({
      id: 'doc-1',
      submissionId: 'ps-other',
      organizationId: 'org-1',
      status: 'ATTACHED',
      storedObjectKey: 'k',
      mimeType: 'application/pdf',
      originalFileName: 'f.pdf',
      sizeBytes: 1,
      category: 'LICENSE',
    }));
    await expect(getSubmissionDocument(opsCtx, 'ps-1', 'doc-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a document in another organization even when ids align', async () => {
    mockPrisma.providerSubmission.findUnique = vi.fn(async () => ({
      id: 'ps-1',
      organizationId: 'org-1',
    }));
    mockPrisma.providerSubmissionDocument.findUnique = vi.fn(async () => ({
      id: 'doc-1',
      submissionId: 'ps-1',
      organizationId: 'org-9',
      status: 'ATTACHED',
      storedObjectKey: 'k',
      mimeType: 'application/pdf',
      originalFileName: 'f.pdf',
      sizeBytes: 1,
      category: 'LICENSE',
    }));
    await expect(getSubmissionDocument(opsCtx, 'ps-1', 'doc-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects PENDING documents not yet claimed by a submission', async () => {
    mockPrisma.providerSubmission.findUnique = vi.fn(async () => ({
      id: 'ps-1',
      organizationId: 'org-1',
    }));
    mockPrisma.providerSubmissionDocument.findUnique = vi.fn(async () => ({
      id: 'doc-1',
      submissionId: 'ps-1',
      organizationId: 'org-1',
      status: 'PENDING',
      storedObjectKey: 'k',
      mimeType: 'application/pdf',
      originalFileName: 'f.pdf',
      sizeBytes: 1,
      category: 'LICENSE',
    }));
    await expect(getSubmissionDocument(opsCtx, 'ps-1', 'doc-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ============================================================================
// §7 — Token validation fails closed for every invalid shape.
// ============================================================================

describe('onboarding token fail-closed semantics', () => {
  it('returns null for malformed, missing, revoked, and expired tokens', async () => {
    expect(await findOnboardingLinkByToken('')).toBeNull();
    expect(await findOnboardingLinkByToken('x')).toBeNull();
    expect(await findOnboardingLinkByToken('a'.repeat(400))).toBeNull();
    expect(await findOnboardingLinkByToken('unknown-token-value-that-is-long-enough')).toBeNull();

    mockPrisma.onboardingLink.findUnique = vi.fn(async () => ({ ...LINK, revokedAt: new Date() }));
    expect(await findOnboardingLinkByToken(TOKEN)).toBeNull();

    mockPrisma.onboardingLink.findUnique = vi.fn(async () => ({
      ...LINK,
      expiresAt: new Date(Date.now() - 1000),
    }));
    expect(await findOnboardingLinkByToken(TOKEN)).toBeNull();

    mockPrisma.onboardingLink.findUnique = vi.fn(async () => ({ ...LINK, expiresAt: null }));
    expect(await findOnboardingLinkByToken(TOKEN)).toBeNull();
  });
});
