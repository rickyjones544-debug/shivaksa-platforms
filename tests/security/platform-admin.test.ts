import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { isPlatformOperator, belongsToOrganization, type AuthenticatedContext } from '@/lib/rbac/authorization';
import { withVoipAuth, withVoipAdminAuth } from '@/app/api/voip/_utils';
import { getCurrentUser } from '@/lib/auth/auth';

vi.mock('@/lib/auth/auth', () => ({
  getCurrentUser: vi.fn(),
}));

function makeCtx(overrides: Partial<AuthenticatedContext> = {}): AuthenticatedContext {
  return {
    user: { id: 'u1', name: 'User', email: 'u@a.com', isSuperAdmin: false },
    membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
    organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
    role: { id: 'r1', name: 'CLIENT_ADMIN' },
    permissions: ['voip:manage', 'wallet:manage', 'wallet:read', 'wallet:write'],
    ...overrides,
  } as AuthenticatedContext;
}

const opsCtx = () =>
  makeCtx({
    role: { id: 'r2', name: 'OPERATIONS_MANAGER' },
    permissions: ['admin:manage', 'voip:manage', 'wallet:manage', 'wallet:read', 'wallet:write'],
  });

const request = () =>
  new NextRequest(new URL('https://app.shivaksatechnology.com/api/voip/admin/customers/org-1/wallet/credit'), {
    method: 'POST',
  });

describe('isPlatformOperator', () => {
  it('treats SUPER_ADMIN as a platform operator', () => {
    const ctx = makeCtx({
      user: { id: 'u9', name: 'Root', email: 'r@a.com', isSuperAdmin: true },
      membership: null,
      organization: null,
      role: null,
      permissions: [],
    });
    expect(isPlatformOperator(ctx)).toBe(true);
  });

  it('treats a role holding admin:manage as a platform operator', () => {
    expect(isPlatformOperator(opsCtx())).toBe(true);
  });

  it('does not treat CLIENT_ADMIN as a platform operator', () => {
    expect(isPlatformOperator(makeCtx())).toBe(false);
  });

  it('does not treat an inactive membership as a platform operator', () => {
    const ctx = opsCtx();
    ctx.membership = { ...ctx.membership!, status: 'SUSPENDED' };
    expect(isPlatformOperator(ctx)).toBe(false);
  });
});

describe('belongsToOrganization with platform operators', () => {
  it('lets a platform operator act on any organization', () => {
    expect(belongsToOrganization(opsCtx(), 'org-2')).toBe(true);
  });

  it('still confines a client admin to their own organization', () => {
    const ctx = makeCtx();
    expect(belongsToOrganization(ctx, 'org-1')).toBe(true);
    expect(belongsToOrganization(ctx, 'org-2')).toBe(false);
  });
});

describe('withVoipAdminAuth platformOnly gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a client admin even when targeting their own organization', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(makeCtx());
    const handler = vi.fn();
    const res = await withVoipAdminAuth(request(), {
      targetOrganizationId: 'org-1',
      scope: 'wallet',
      action: 'write',
      platformOnly: true,
      handler,
    });
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('lets a platform operator perform the operation on any organization', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(opsCtx());
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const res = await withVoipAdminAuth(request(), {
      targetOrganizationId: 'org-2',
      scope: 'wallet',
      action: 'write',
      platformOnly: true,
      handler,
    });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ ok: true });
  });

  it('still permits a client admin on non-platformOnly admin routes for their own org', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(makeCtx());
    const handler = vi.fn().mockResolvedValue({ listed: true });
    const res = await withVoipAdminAuth(request(), {
      targetOrganizationId: 'org-1',
      scope: 'voip',
      action: 'read',
      resource: 'sip',
      handler,
    });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('rejects a client admin targeting another organization', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(makeCtx());
    const res = await withVoipAdminAuth(request(), {
      targetOrganizationId: 'org-2',
      scope: 'voip',
      action: 'read',
      resource: 'sip',
      handler: async () => ({}),
    });
    expect(res.status).toBe(403);
  });
});

describe('CSV/Response passthrough', () => {
  beforeEach(() => vi.clearAllMocks());

  const authed = () => vi.mocked(getCurrentUser).mockResolvedValue(makeCtx());

  it('withVoipAuth returns a raw CSV Response untouched', async () => {
    authed();
    const csv = 'id,status\ncall-1,COMPLETED\n';
    const res = await withVoipAuth(request(), {
      scope: 'voip',
      action: 'read',
      resource: 'calls',
      handler: async () =>
        new NextResponse(csv, {
          headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="cdr.csv"' },
        }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(await res.text()).toBe(csv);
  });

  it('withVoipAdminAuth returns a raw CSV Response untouched', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(opsCtx());
    const csv = 'id,profit\ncall-1,0.01\n';
    const res = await withVoipAdminAuth(request(), {
      targetOrganizationId: 'org-1',
      scope: 'voip',
      action: 'read',
      resource: 'calls',
      platformOnly: true,
      handler: async () =>
        new NextResponse(csv, { headers: { 'content-type': 'text/csv' } }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(await res.text()).toBe(csv);
  });

  it('still wraps normal values in the JSON envelope', async () => {
    authed();
    const res = await withVoipAuth(request(), {
      scope: 'voip',
      action: 'read',
      resource: 'calls',
      handler: async () => [{ id: 'call-1' }],
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ id: 'call-1' }]);
  });
});
