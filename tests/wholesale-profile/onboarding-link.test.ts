import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import {
  createOnboardingLink,
  listOnboardingLinks,
  revokeOnboardingLink,
  validateOnboardingLink,
  recordOnboardingView,
  generateOnboardingToken,
  hashOnboardingToken,
  OnboardingLinkError,
} from '@/lib/wholesale-profile/services/onboarding-link';
import { getRolePermissions } from '@/lib/rbac/roles';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

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

function mockOnboardingLinkTable(link: object | null) {
  (prisma as any).onboardingLink = {
    findUnique: vi.fn().mockResolvedValue(link),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(async ({ data }: any) => ({ id: 'ol1', viewCount: 0, submissionCount: 0, ...data })),
    update: vi.fn(async ({ data }: any) => ({ ...data })),
  };
}

const validLink = {
  id: 'ol1',
  organizationId: 'org-1',
  tokenHash: '',
  expiresAt: new Date(Date.now() + 86400_000),
  revokedAt: null,
  viewCount: 0,
  submissionCount: 0,
};

describe('Onboarding links — token security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).auditLog = { create: vi.fn() };
  });

  it('generates tokens with at least 32 bytes of randomness', () => {
    const a = generateOnboardingToken();
    const b = generateOnboardingToken();
    expect(a).not.toBe(b);
    // base64url encoding of 32 bytes → 43 characters, URL-safe
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashOnboardingToken(a)).toBe(sha256(a));
  });

  it('createOnboardingLink stores only the SHA-256 hash — never the raw token', async () => {
    mockOnboardingLinkTable(null);
    const { link, token } = await createOnboardingLink(opsCtx, {
      label: 'Acme carrier',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const createData = (prisma as any).onboardingLink.create.mock.calls[0][0].data;
    expect(createData.tokenHash).toBe(sha256(token));
    expect(createData.tokenHash).not.toBe(token);
    expect(JSON.stringify(createData)).not.toContain(token);
    // The raw token is returned to the creator exactly once
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link.organizationId).toBe('org-1');
  });

  it('audit record for link creation contains no raw token', async () => {
    mockOnboardingLinkTable(null);
    const { token } = await createOnboardingLink(opsCtx, {
      expiresAt: new Date(Date.now() + 86400_000),
    });
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).not.toContain(token);
  });

  it('validateOnboardingLink resolves a valid token to its owning organization', async () => {
    const token = generateOnboardingToken();
    mockOnboardingLinkTable({ ...validLink, tokenHash: sha256(token) });

    const result = await validateOnboardingLink(token);
    expect(result).toEqual({ id: 'ol1', organizationId: 'org-1' });

    // Lookup is by hash only — the raw token is never used as a query value
    const where = (prisma as any).onboardingLink.findUnique.mock.calls[0][0].where;
    expect(where.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(where)).not.toContain(token);
  });

  it('the validation result exposes no token material', async () => {
    const token = generateOnboardingToken();
    mockOnboardingLinkTable({ ...validLink, tokenHash: sha256(token) });
    const result = await validateOnboardingLink(token);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(sha256(token));
    expect(result).not.toHaveProperty('tokenHash');
  });

  it('random invalid token fails closed', async () => {
    mockOnboardingLinkTable(null);
    expect(await validateOnboardingLink(generateOnboardingToken())).toBeNull();
  });

  it('expired token fails closed', async () => {
    const token = generateOnboardingToken();
    mockOnboardingLinkTable({
      ...validLink,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await validateOnboardingLink(token)).toBeNull();
  });

  it('revoked token fails closed', async () => {
    const token = generateOnboardingToken();
    mockOnboardingLinkTable({
      ...validLink,
      tokenHash: sha256(token),
      revokedAt: new Date(),
    });
    expect(await validateOnboardingLink(token)).toBeNull();
  });

  it('missing or malformed token fails closed without a database lookup', async () => {
    mockOnboardingLinkTable(null);
    expect(await validateOnboardingLink('')).toBeNull();
    expect(await validateOnboardingLink('short')).toBeNull();
    expect((prisma as any).onboardingLink.findUnique).not.toHaveBeenCalled();
  });

  it('different links resolve independently — no cross-resolution', async () => {
    const tokenA = generateOnboardingToken();
    const tokenB = generateOnboardingToken();
    (prisma as any).onboardingLink = {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.tokenHash === sha256(tokenA)) {
          return { ...validLink, id: 'ol-A', organizationId: 'org-1' };
        }
        if (where.tokenHash === sha256(tokenB)) {
          return { ...validLink, id: 'ol-B', organizationId: 'org-2' };
        }
        return null;
      }),
    };
    expect(await validateOnboardingLink(tokenA)).toEqual({ id: 'ol-A', organizationId: 'org-1' });
    expect(await validateOnboardingLink(tokenB)).toEqual({ id: 'ol-B', organizationId: 'org-2' });
    expect(await validateOnboardingLink(generateOnboardingToken())).toBeNull();
  });

  it('recordOnboardingView increments viewCount atomically and never touches submissionCount', async () => {
    mockOnboardingLinkTable(validLink);
    await recordOnboardingView({ id: 'ol1', organizationId: 'org-1' });

    const update = (prisma as any).onboardingLink.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'ol1' });
    expect(update.data.viewCount).toEqual({ increment: 1 });
    expect(update.data.lastViewedAt).toBeInstanceOf(Date);
    expect(update.data).not.toHaveProperty('submissionCount');
  });

  it('view audit contains no token material', async () => {
    const token = generateOnboardingToken();
    mockOnboardingLinkTable(validLink);
    await recordOnboardingView({ id: 'ol1', organizationId: 'org-1' });
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).not.toContain(token);
    expect(auditArgs).not.toContain(sha256(token));
    expect(auditArgs).toContain('ONBOARDING_LINK_VIEWED');
  });

  it('the validation API accepts only a token — no org/provider/version selector', () => {
    // One-parameter signature: callers cannot inject organizationId,
    // providerId, or version identifiers through this boundary.
    expect(validateOnboardingLink.length).toBe(1);
  });
});

describe('Onboarding links — internal RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).auditLog = { create: vi.fn() };
  });

  it('OPERATIONS_MANAGER can manage links; INTERNAL_STAFF read-only; CLIENT_* denied', () => {
    expect(hasPermission(opsCtx, 'provider', 'write', 'links')).toBe(true);
    expect(hasPermission(opsCtx, 'provider', 'read', 'links')).toBe(true);
    expect(hasPermission(staffCtx, 'provider', 'read', 'links')).toBe(true);
    expect(hasPermission(staffCtx, 'provider', 'write', 'links')).toBe(false);
    expect(hasPermission(clientCtx, 'provider', 'read', 'links')).toBe(false);
    expect(hasPermission(clientCtx, 'provider', 'write', 'links')).toBe(false);
  });

  it('create/revoke require provider:write:links server-side', async () => {
    mockOnboardingLinkTable(validLink);
    await expect(
      createOnboardingLink(clientCtx, { expiresAt: new Date() })
    ).rejects.toThrow(OnboardingLinkError);
    await expect(revokeOnboardingLink(clientCtx, 'ol1')).rejects.toThrow(OnboardingLinkError);
    expect((prisma as any).onboardingLink.create).not.toHaveBeenCalled();
  });

  it('revoke sets revokedAt and audits without token material', async () => {
    mockOnboardingLinkTable({ ...validLink, organizationId: 'org-1' });
    await revokeOnboardingLink(opsCtx, 'ol1');
    const update = (prisma as any).onboardingLink.update.mock.calls[0][0];
    expect(update.data.revokedAt).toBeInstanceOf(Date);
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('ONBOARDING_LINK_REVOKED');
  });

  it('listings never include tokenHash', async () => {
    mockOnboardingLinkTable(null);
    await listOnboardingLinks(opsCtx);
    const select = (prisma as any).onboardingLink.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('tokenHash');
  });

  it('a link belonging to another organization cannot be revoked', async () => {
    mockOnboardingLinkTable({ ...validLink, organizationId: 'org-2' });
    await expect(revokeOnboardingLink(opsCtx, 'ol1')).rejects.toThrow('not found');
    expect((prisma as any).onboardingLink.update).not.toHaveBeenCalled();
  });
});
