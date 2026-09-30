import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import {
  submitProviderIntake,
  listProviderSubmissions,
  getProviderSubmission,
  setProviderSubmissionStatus,
  promoteSubmissionToProvider,
  SubmissionError,
} from '@/lib/wholesale-profile/services/submission';
import { getRolePermissions } from '@/lib/rbac/roles';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'vt_' + 'a'.repeat(40);
const PAYLOAD = { company: { companyName: 'Acme Telecom Ltd' } };

const opsCtx: AuthenticatedContext = {
  user: { id: 'u2', name: 'Ops', email: 'ops@example.com', isSuperAdmin: false },
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
  role: { id: 'r4', name: 'CLIENT_ADMIN' },
  permissions: getRolePermissions('CLIENT_ADMIN'),
};

function validLink(overrides: object = {}) {
  return {
    id: 'ol1',
    organizationId: 'org-1',
    tokenHash: sha256(TOKEN),
    expiresAt: new Date(Date.now() + 86400_000),
    revokedAt: null,
    maxSubmissions: 3,
    submissionCount: 0,
    ...overrides,
  };
}

function mockBackend({
  link = undefined as object | null | undefined,
  claimed = 1,
  submission = undefined as object | null | undefined,
} = {}) {
  const realLink = link === undefined ? validLink() : link;

  const tx = {
    $executeRaw: vi.fn(async () => claimed),
    providerSubmission: {
      create: vi.fn(async ({ data }: any) => ({ id: 'ps1', ...data })),
      update: vi.fn(async ({ data }: any) => data),
    },
    providerSubmissionDocument: { updateMany: vi.fn(async () => ({})) },
    providerContact: { createMany: vi.fn(async () => ({})) },
  };

  (prisma as any).onboardingLink = {
    findUnique: vi.fn(async ({ where }: any) =>
      realLink && where.tokenHash === (realLink as any).tokenHash ? realLink : null
    ),
  };
  (prisma as any).$transaction = vi.fn(async (cb: any) => cb(tx));
  (prisma as any).wholesaleProfile = {
    findUnique: vi.fn(async () => ({
      id: 'wp1', organizationId: 'org-1', requirementSetId: 'rs1',
      publishedVersionNumber: 1, status: 'ACTIVE', title: 't', subtitle: null,
    })),
  };
  (prisma as any).requirementVersion = {
    findUnique: vi.fn(async () => ({ id: 'rv1', status: 'PUBLISHED' })),
  };
  (prisma as any).requirementVersionSection = {
    findMany: vi.fn(async () => [{ id: 's1', key: 'COMPANY_PROFILE', title: 't', description: null, sortOrder: 1, visibility: 'PUBLISHABLE', isRequired: true, content: {} }]),
  };
  (prisma as any).providerSubmission = {
    findUnique: vi.fn(async () => submission ?? null),
    findMany: vi.fn(async () => []),
    update: vi.fn(async ({ data }: any) => data),
  };
  (prisma as any).provider = {
    findUnique: vi.fn(async () => null),
    create: vi.fn(async ({ data }: any) => ({ id: 'prov-1', ...data })),
  };

  return { tx };
}

const acceptedSubmission = {
  id: 'ps1',
  organizationId: 'org-1',
  onboardingLinkId: 'ol1',
  providerId: null,
  companyName: 'Acme Telecom Ltd',
  website: null,
  country: 'GR',
  status: 'ACCEPTED',
  payload: {
    company: { companyName: 'Acme Telecom Ltd', legalName: 'Acme Holdings' },
    contacts: [
      { role: 'SALES', name: 'Jane', email: 'j@acme.example.com' },
      { role: 'ACCOUNT', name: 'Mgr', phone: '+1' },
    ],
  },
};

describe('submitProviderIntake — token-scoped intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).auditLog = { create: vi.fn() };
    mockBackend();
  });

  it('creates a NEW submission under the link-derived organization', async () => {
    const { tx } = mockBackend();
    const r = await submitProviderIntake(TOKEN, PAYLOAD);

    expect(r).toEqual({ received: true });
    const data = tx.providerSubmission.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
    expect(data.onboardingLinkId).toBe('ol1');
    expect(data.providerId).toBeNull();
    expect(data.status).toBe('NEW');
    expect(data.companyName).toBe('Acme Telecom Ltd');
  });

  it('claims the submission slot atomically before inserting', async () => {
    const { tx } = mockBackend();
    await submitProviderIntake(TOKEN, PAYLOAD);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.providerSubmission.create).toHaveBeenCalledTimes(1);
  });

  it('claims the link\'s pending documents into the submission snapshot in the same transaction', async () => {
    const { tx } = mockBackend();
    await submitProviderIntake(TOKEN, PAYLOAD);
    const claim = (tx.providerSubmissionDocument.updateMany.mock.calls[0] as any)[0];
    expect(claim.where).toEqual({ onboardingLinkId: 'ol1', submissionId: null, status: 'PENDING' });
    expect(claim.data).toEqual({ submissionId: 'ps1', status: 'ATTACHED' });
  });

  it('returns nothing identifying about the internal record', async () => {
    mockBackend();
    const r = await submitProviderIntake(TOKEN, PAYLOAD);
    expect(JSON.stringify(r)).not.toContain('ps1');
    expect(JSON.stringify(r)).not.toContain('org-1');
    expect(JSON.stringify(r)).not.toContain('ol1');
  });

  it.each([
    ['invalid token', () => mockBackend({ link: null })],
    ['expired link', () => mockBackend({ link: validLink({ expiresAt: new Date(Date.now() - 1000) }) })],
    ['revoked link', () => mockBackend({ link: validLink({ revokedAt: new Date() }) })],
  ])('fails closed: %s → generic UNAVAILABLE, nothing written', async (_name, setup) => {
    const { tx } = setup() as { tx: any };
    await expect(submitProviderIntake(TOKEN, PAYLOAD)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(tx.providerSubmission.create).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('missing token fails closed', async () => {
    mockBackend();
    await expect(submitProviderIntake('', PAYLOAD)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('fails when the published profile no longer resolves', async () => {
    const { tx } = mockBackend();
    (prisma as any).wholesaleProfile.findUnique.mockResolvedValue({ status: 'ARCHIVED' });
    await expect(submitProviderIntake(TOKEN, PAYLOAD)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(tx.providerSubmission.create).not.toHaveBeenCalled();
  });

  it('invalid payload fails validation WITHOUT consuming a submission slot', async () => {
    const { tx } = mockBackend();
    await expect(submitProviderIntake(TOKEN, { company: {} })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.providerSubmission.create).not.toHaveBeenCalled();
  });

  it('maxSubmissions reached → the conditional UPDATE claims 0 → UNAVAILABLE, no insert', async () => {
    const { tx } = mockBackend({ claimed: 0 });
    await expect(submitProviderIntake(TOKEN, PAYLOAD)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(tx.providerSubmission.create).not.toHaveBeenCalled();
  });

  it('never queries or stores the raw token', async () => {
    mockBackend();
    await submitProviderIntake(TOKEN, PAYLOAD);
    const where = (prisma as any).onboardingLink.findUnique.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain(TOKEN);
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).not.toContain(TOKEN);
    expect(auditArgs).not.toContain(sha256(TOKEN));
  });
});

describe('Internal review service — RBAC, org isolation, immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).auditLog = { create: vi.fn() };
    mockBackend();
  });

  it('list requires provider:read:submissions and scopes to the org', async () => {
    mockBackend();
    await listProviderSubmissions(opsCtx, {});
    const where = (prisma as any).providerSubmission.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    await expect(listProviderSubmissions(clientCtx, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('get refuses submissions from another organization', async () => {
    mockBackend({ submission: { ...acceptedSubmission, organizationId: 'org-2' } });
    await expect(getProviderSubmission(opsCtx, 'ps1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('get audits the internal view', async () => {
    mockBackend({ submission: acceptedSubmission });
    await getProviderSubmission(opsCtx, 'ps1');
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('PROVIDER_SUBMISSION_VIEWED');
  });

  it('status transitions follow NEW → REVIEWING → ACCEPTED/REJECTED', async () => {
    mockBackend({ submission: { ...acceptedSubmission, status: 'NEW' } });
    await setProviderSubmissionStatus(opsCtx, 'ps1', 'REVIEWING');
    expect((prisma as any).providerSubmission.update).toHaveBeenCalled();

    mockBackend({ submission: { ...acceptedSubmission, status: 'REVIEWING' } });
    await setProviderSubmissionStatus(opsCtx, 'ps1', 'ACCEPTED', 'looks good');
    const data = (prisma as any).providerSubmission.update.mock.calls[0][0].data;
    expect(data.reviewedById).toBe('u2');
    expect(data.reviewNotes).toBe('looks good');
  });

  it.each(['ACCEPTED', 'REJECTED'] as const)('a finalized (%s) submission cannot be modified', async (status) => {
    mockBackend({ submission: { ...acceptedSubmission, status } });
    await expect(setProviderSubmissionStatus(opsCtx, 'ps1', 'REVIEWING')).rejects.toMatchObject({ code: 'STATE' });
    await expect(setProviderSubmissionStatus(opsCtx, 'ps1', status === 'ACCEPTED' ? 'REJECTED' : 'ACCEPTED')).rejects.toMatchObject({ code: 'STATE' });
    expect((prisma as any).providerSubmission.update).not.toHaveBeenCalled();
  });

  it('status changes audit the transition', async () => {
    mockBackend({ submission: { ...acceptedSubmission, status: 'REVIEWING' } });
    await setProviderSubmissionStatus(opsCtx, 'ps1', 'REJECTED');
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('PROVIDER_SUBMISSION_REJECTED');
  });

  it('CLIENT_* roles cannot read or mutate submissions', async () => {
    mockBackend({ submission: acceptedSubmission });
    await expect(getProviderSubmission(clientCtx, 'ps1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(setProviderSubmissionStatus(clientCtx, 'ps1', 'REVIEWING')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(promoteSubmissionToProvider(clientCtx, 'ps1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('promoteSubmissionToProvider — explicit internal promotion only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).auditLog = { create: vi.fn() };
    mockBackend();
  });

  it('promotes an ACCEPTED submission: creates Provider, links it, creates contacts', async () => {
    const { tx } = mockBackend({ submission: acceptedSubmission });
    const r = await promoteSubmissionToProvider(opsCtx, 'ps1');

    const providerData = (prisma as any).provider.create.mock.calls[0][0].data;
    expect(providerData.organizationId).toBe('org-1');
    expect(providerData.companyName).toBe('Acme Telecom Ltd');
    expect(providerData).not.toHaveProperty('carrierId');
    expect(providerData).not.toHaveProperty('lifecycleStage'); // PROSPECT default — no activation
    expect(r.providerId).toBe('prov-1');

    const linkUpdate = tx.providerSubmission.update.mock.calls[0][0];
    expect(linkUpdate.data.providerId).toBe('prov-1');

    const contacts = (tx.providerContact.createMany.mock.calls[0] as any)[0].data;
    expect(contacts).toHaveLength(2);
    expect(contacts[0].role).toBe('SALES');
    expect(contacts[1].role).toBe('ACCOUNT_MANAGER'); // ACCOUNT maps to enum value

    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('PROVIDER_SUBMISSION_PROMOTED');
  });

  it('rejects promotion of non-ACCEPTED submissions', async () => {
    for (const status of ['NEW', 'REVIEWING', 'REJECTED']) {
      mockBackend({ submission: { ...acceptedSubmission, status } });
      await expect(promoteSubmissionToProvider(opsCtx, 'ps1')).rejects.toMatchObject({ code: 'STATE' });
      expect((prisma as any).provider.create).not.toHaveBeenCalled();
    }
  });

  it('rejects double-promotion', async () => {
    mockBackend({ submission: { ...acceptedSubmission, providerId: 'prov-9' } });
    await expect(promoteSubmissionToProvider(opsCtx, 'ps1')).rejects.toMatchObject({ code: 'STATE' });
  });

  it('links to an existing provider only in the same org', async () => {
    mockBackend({ submission: acceptedSubmission });
    (prisma as any).provider.findUnique.mockResolvedValue({ id: 'prov-x', organizationId: 'org-2' });
    await expect(promoteSubmissionToProvider(opsCtx, 'ps1', { existingProviderId: 'prov-x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    (prisma as any).provider.findUnique.mockResolvedValue({ id: 'prov-y', organizationId: 'org-1' });
    const r = await promoteSubmissionToProvider(opsCtx, 'ps1', { existingProviderId: 'prov-y' });
    expect(r.providerId).toBe('prov-y');
    expect((prisma as any).provider.create).not.toHaveBeenCalled();
  });

  it('read-only INTERNAL_STAFF cannot promote', async () => {
    mockBackend({ submission: acceptedSubmission });
    await expect(promoteSubmissionToProvider(staffCtx, 'ps1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('promotion never creates rates, credentials, routes, or billing', async () => {
    mockBackend({ submission: acceptedSubmission });
    await promoteSubmissionToProvider(opsCtx, 'ps1');
    // The service only touches providerSubmission, provider, providerContact —
    // no carrierRate, carrierCredential, routePolicy, invoice, or payment calls exist.
    for (const model of ['carrierRate', 'carrierCredential', 'carrierRoutePolicy', 'providerInvoice', 'providerPayment']) {
      expect((prisma as any)[model]).toBeUndefined();
    }
    const providerData = (prisma as any).provider.create.mock.calls[0][0].data;
    expect(providerData).not.toHaveProperty('carrierId');
    expect(providerData).not.toHaveProperty('status');
  });
});
