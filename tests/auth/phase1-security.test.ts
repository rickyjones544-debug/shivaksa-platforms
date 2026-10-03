import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/db/prisma';
import { loginUser, registerUser } from '@/lib/auth/auth';
import { getSession } from '@/lib/auth/session';
import { switchOrganization } from '@/lib/auth/switch-org';
import { acceptInvitation, createInvitation } from '@/lib/invitations/service';
import { requirePlatformAdminPage } from '@/lib/auth/admin-page';
import { getRateLimitIdentifier } from '@/lib/rate-limit';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

const { cookieGet, redirect, notFound, resolveAuthContext } = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  resolveAuthContext: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: {} as Record<string, unknown> }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet, set: vi.fn() })),
}));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('@/lib/tenant/context', () => ({ resolveAuthContext }));
vi.mock('@/lib/auth/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/password')>();
  return {
    ...actual,
    hashPassword: vi.fn(async () => 'hash'),
    verifyPassword: vi.fn(async () => true),
  };
});
vi.mock('@/lib/voip/services/audit', () => ({ audit: vi.fn(async () => {}) }));

type MockFn = ReturnType<typeof vi.fn>;
type PrismaMock = {
  user: { findUnique: MockFn; create: MockFn; count: MockFn };
  session: { findUnique: MockFn; create: MockFn; update: MockFn; updateMany: MockFn };
  role: { findUnique: MockFn };
  organization: { findUnique: MockFn; create: MockFn };
  organizationMembership: { findMany: MockFn; findFirst: MockFn; findUnique: MockFn; create: MockFn };
  invitation: { findUnique: MockFn; findMany: MockFn; create: MockFn; update: MockFn };
};

const db = prisma as unknown as PrismaMock;
const activeCtx: AuthenticatedContext = {
  user: { id: 'user-1', name: 'Active', email: 'active@example.com', isSuperAdmin: false },
  membership: { id: 'member-1', organizationId: 'org-1', roleId: 'role-client', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Org', slug: 'org' },
  role: { id: 'role-client', name: 'CLIENT_ADMIN' },
  permissions: ['organization:read'],
};
const tenantAdmin: AuthenticatedContext = {
  ...activeCtx,
  permissions: ['invitation:write'],
};
const platformAdmin: AuthenticatedContext = {
  ...activeCtx,
  user: { ...activeCtx.user, isSuperAdmin: true },
};

function installDb() {
  db.user = { findUnique: vi.fn(), create: vi.fn(), count: vi.fn(async () => 1) };
  db.session = {
    findUnique: vi.fn(),
    create: vi.fn(async ({ data }) => ({ id: 'session-1', ...data })),
    update: vi.fn(async ({ data }) => ({ id: 'session-1', ...data })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
  db.role = { findUnique: vi.fn() };
  db.organization = {
    findUnique: vi.fn(async () => ({ id: 'org-1' })),
    create: vi.fn(async () => ({ id: 'org-1' })),
  };
  db.organizationMembership = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(async () => ({ id: 'member-1' })),
  };
  db.invitation = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(async ({ data }) => ({ id: 'invite-1', ...data })),
    update: vi.fn(async ({ data }) => ({ id: 'invite-1', ...data })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  installDb();
  cookieGet.mockReturnValue({ value: 'session-token' });
  resolveAuthContext.mockResolvedValue(activeCtx);
});

describe('active user session policy', () => {
  it('rejects PENDING login without creating a session', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'PENDING', passwordHash: 'hash' });
    await expect(loginUser('pending@example.com', 'Valid1!Password')).resolves.toEqual({
      success: false,
      error: 'Invalid email or password',
    });
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('allows ACTIVE login and creates a session', async () => {
    db.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', status: 'ACTIVE', passwordHash: 'hash' })
      .mockResolvedValueOnce({ status: 'ACTIVE' });
    const result = await loginUser('active@example.com', 'Valid1!Password');
    expect(result.success).toBe(true);
    expect(db.session.create).toHaveBeenCalledTimes(1);
  });

  it('registration leaves the user pending and creates no session', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: 'user-1', status: 'PENDING' });
    db.role.findUnique.mockResolvedValue({ id: 'role-client' });
    await expect(registerUser({
      name: 'Pending User',
      email: 'pending@example.com',
      password: 'Valid1!Password',
      confirmPassword: 'Valid1!Password',
    })).resolves.toEqual({ success: true, pending: true });
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('revokes and rejects an existing session after suspension', async () => {
    db.session.findUnique.mockResolvedValue({
      id: 'session-1', revoked: false, expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', status: 'SUSPENDED' },
    });
    await expect(getSession('session-token')).resolves.toBeNull();
    expect(db.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' }, data: { revoked: true },
    });
  });

  it('rejects an expired session', async () => {
    db.session.findUnique.mockResolvedValue({
      id: 'session-1', revoked: false, expiresAt: new Date(Date.now() - 60_000),
      user: { id: 'user-1', status: 'ACTIVE' },
    });
    await expect(getSession('session-token')).resolves.toBeNull();
    expect(db.session.update).not.toHaveBeenCalled();
  });

  it('blocks organization switching with an expired session', async () => {
    db.session.findUnique.mockResolvedValue({
      id: 'session-1', revoked: false, expiresAt: new Date(Date.now() - 60_000),
      user: { id: 'user-1', status: 'ACTIVE' },
    });
    await expect(switchOrganization('org-1')).resolves.toEqual({ success: false, error: 'Unauthorized' });
    expect(db.organizationMembership.findFirst).not.toHaveBeenCalled();
  });
});

describe('invitation security', () => {
  it('rejects a platform role supplied by a tenant administrator', async () => {
    db.role.findUnique.mockResolvedValue({
      id: 'role-ops', name: 'OPERATIONS_MANAGER', permissions: [],
    });
    await expect(createInvitation(tenantAdmin, 'org-1', {
      email: 'invite@example.com', roleId: 'role-ops',
    })).rejects.toThrow('platform roles cannot be assigned');
    expect(db.invitation.create).not.toHaveBeenCalled();
  });

  it('allows a permitted tenant role invitation', async () => {
    db.role.findUnique.mockResolvedValue({
      id: 'role-viewer', name: 'CLIENT_VIEWER', permissions: [],
    });
    await expect(createInvitation(tenantAdmin, 'org-1', {
      email: 'invite@example.com', roleId: 'role-viewer',
    })).resolves.toMatchObject({ invitation: { roleId: 'role-viewer' } });
  });

  it('rejects a weak invitation password', async () => {
    db.invitation.findUnique.mockResolvedValue({
      id: 'invite-1', email: 'invite@example.com', organizationId: 'org-1',
      roleId: 'role-viewer', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
    });
    db.user.findUnique.mockResolvedValue(null);
    await expect(acceptInvitation('token', { name: 'Invitee', password: 'weak' }))
      .rejects.toThrow('at least 8 characters');
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('accepts a valid invitation password', async () => {
    db.invitation.findUnique.mockResolvedValue({
      id: 'invite-1', email: 'invite@example.com', organizationId: 'org-1',
      roleId: 'role-viewer', status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
    });
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: 'user-2', status: 'ACTIVE' });
    db.organizationMembership.findUnique.mockResolvedValue(null);
    await expect(acceptInvitation('token', {
      name: 'Invitee', password: 'Valid1!Password',
    })).resolves.toMatchObject({ user: { id: 'user-2' }, organizationId: 'org-1' });
  });
});

describe('admin page boundary', () => {
  it('redirects anonymous users before rendering', async () => {
    const auth = await import('@/lib/auth/auth');
    const spy = vi.spyOn(auth, 'getCurrentUser').mockResolvedValueOnce(null);
    await expect(requirePlatformAdminPage('/admin/organizations'))
      .rejects.toThrow('REDIRECT:/login?redirect=%2Fadmin%2Forganizations');
    spy.mockRestore();
  });

  it('denies non-platform users and allows platform administrators', async () => {
    const auth = await import('@/lib/auth/auth');
    const spy = vi.spyOn(auth, 'getCurrentUser');
    spy.mockResolvedValueOnce(activeCtx);
    await expect(requirePlatformAdminPage('/admin')).rejects.toThrow('NOT_FOUND');
    spy.mockResolvedValueOnce(platformAdmin);
    await expect(requirePlatformAdminPage('/admin')).resolves.toEqual(platformAdmin);
    spy.mockRestore();
  });

  it('covers every app/admin entry point and verifies standalone admin guards', () => {
    const root = process.cwd();
    const layout = fs.readFileSync(path.join(root, 'app/admin/layout.tsx'), 'utf8');
    expect(layout).toContain('requirePlatformAdminPage');
    for (const relative of [
      'app/admin/page.tsx',
      'app/admin/users/page.tsx',
      'app/admin/organizations/page.tsx',
      'app/admin/onboarding/page.tsx',
      'app/admin/onboarding/[id]/page.tsx',
      'app/admin/voip/page.tsx',
      'app/admin/voip/customers/[id]/page.tsx',
    ]) {
      expect(fs.existsSync(path.join(root, relative)), relative).toBe(true);
    }
    for (const relative of [
      'app/(admin)/admin/rate-desk/page.tsx',
      'app/(admin)/admin/rate-desk/compare/page.tsx',
      'app/(admin)/admin/rate-desk/history/page.tsx',
      'app/(admin)/admin/rate-desk/sheets/[sheetId]/page.tsx',
      'app/(admin)/admin/rate-desk/sheets/[sheetId]/versions/[version]/page.tsx',
      'app/(admin)/admin/rate-desk/sheets/[sheetId]/versions/[version]/review/page.tsx',
      'app/(admin)/admin/voice-test/page.tsx',
    ]) {
      const source = fs.readFileSync(path.join(root, relative), 'utf8');
      expect(source, relative).toContain('getCurrentUser');
      expect(source, relative).toMatch(/redirect\(['"]\/login/);
    }
  });
});

describe('trusted proxy rate-limit identity', () => {
  it('prefers Nginx-overwritten X-Real-IP', () => {
    const request = { headers: new Headers({
      'x-real-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.20, 203.0.113.10',
    }) } as never;
    expect(getRateLimitIdentifier(request)).toBe('203.0.113.10');
  });

  it('uses the nearest proxy entry rather than a client-controlled first entry', () => {
    const request = { headers: new Headers({
      'x-forwarded-for': '198.51.100.20, 203.0.113.10',
    }) } as never;
    expect(getRateLimitIdentifier(request)).toBe('203.0.113.10');
  });
});
