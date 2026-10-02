import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { getCurrentUser } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/auth/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationMembership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

function platformCtx(): AuthenticatedContext {
  return {
    user: { id: 'admin-1', name: 'Admin', email: 'admin@shivaksa.com', isSuperAdmin: true },
    membership: null,
    organization: null,
    role: null,
    permissions: [],
  } as unknown as AuthenticatedContext;
}

function clientAdminCtx(orgId = 'org-1'): AuthenticatedContext {
  return {
    user: { id: 'u1', name: 'Client', email: 'c@acme.com', isSuperAdmin: false },
    membership: { id: 'm1', organizationId: orgId, roleId: 'r-client', status: 'ACTIVE' },
    organization: { id: orgId, name: 'Acme', slug: 'acme' },
    role: { id: 'r-client', name: 'CLIENT_ADMIN' },
    permissions: [
      'organization:read',
      'organization:write',
      'organization:manage',
      'membership:read',
      'membership:write',
      'membership:manage',
    ],
  } as unknown as AuthenticatedContext;
}

const jsonRequest = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(new URL(url, 'https://app.shivaksatechnology.com'), {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const params = (id: string, membershipId?: string) => ({
  params: Promise.resolve(
    (membershipId ? { id, membershipId } : { id }) as { id: string; membershipId: string }
  ),
});

const clientRole = {
  id: 'r-client-admin',
  name: 'CLIENT_ADMIN',
  permissions: [{ permission: { key: 'voip:manage' } }],
};

const platformRole = {
  id: 'r-super',
  name: 'SUPER_ADMIN',
  permissions: [{ permission: { key: '*' } }],
};

describe('admin organization creation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets a platform admin create an organization', async () => {
    const { POST } = await import('@/app/api/admin/organizations/route');
    vi.mocked(getCurrentUser).mockResolvedValue(platformCtx());
    vi.mocked(prisma.organization.create).mockResolvedValue({
      id: 'org-new',
      name: 'Acme Corp',
      slug: 'acme-corp-x',
      status: 'ACTIVE',
    } as never);

    const res = await POST(jsonRequest('https://app.shivaksatechnology.com/api/admin/organizations', { name: 'Acme Corp' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Acme Corp', status: 'ACTIVE' }) })
    );
  });

  it('rejects a CLIENT_ADMIN creating an organization', async () => {
    const { POST } = await import('@/app/api/admin/organizations/route');
    vi.mocked(getCurrentUser).mockResolvedValue(clientAdminCtx());
    const res = await POST(jsonRequest('https://app.shivaksatechnology.com/api/admin/organizations', { name: 'Evil Org' }));
    expect(res.status).toBe(403);
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('rejects a CLIENT_ADMIN suspending an organization (self-unsuspend guard)', async () => {
    const { PATCH } = await import('@/app/api/admin/organizations/[id]/route');
    vi.mocked(getCurrentUser).mockResolvedValue(clientAdminCtx());
    const res = await PATCH(
      jsonRequest('https://app.shivaksatechnology.com/api/admin/organizations/org-1', { status: 'SUSPENDED' }, 'PATCH'),
      params('org-1')
    );
    expect(res.status).toBe(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid organization status', async () => {
    const { updateOrganization } = await import('@/lib/organizations/service');
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1', status: 'ACTIVE' } as never);
    await expect(
      updateOrganization(platformCtx(), 'org-1', { status: 'BANANA' } as never)
    ).rejects.toThrow('Invalid organization status');
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});

describe('admin customer user creation', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockHappyMembershipCreate() {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1' } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue(clientRole as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.count).mockResolvedValue(5);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'u-new' } as never);
    vi.mocked(prisma.organizationMembership.create).mockResolvedValue({
      id: 'm-new',
      userId: 'u-new',
      organizationId: 'org-1',
      roleId: 'r-client-admin',
      status: 'PENDING',
    } as never);
  }

  it('platform admin creates a PENDING membership with CLIENT_ADMIN role', async () => {
    const { createMembership } = await import('@/lib/memberships/service');
    mockHappyMembershipCreate();
    const result = await createMembership(platformCtx(), 'org-1', {
      name: 'Jane Customer',
      email: 'jane@acme.com',
      password: 'Str0ng!Pass',
      roleId: 'r-client-admin',
      status: 'PENDING',
    });
    expect(result.status).toBe('PENDING');
    expect(prisma.organizationMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1', roleId: 'r-client-admin', status: 'PENDING' }),
      })
    );
  });

  it('membership POST route is platform+tenant usable and returns the membership', async () => {
    const { POST } = await import('@/app/api/admin/organizations/[id]/members/route');
    vi.mocked(getCurrentUser).mockResolvedValue(platformCtx());
    mockHappyMembershipCreate();
    const res = await POST(
      jsonRequest('https://app.shivaksatechnology.com/api/admin/organizations/org-1/members', {
        name: 'Jane',
        email: 'jane@acme.com',
        password: 'Str0ng!Pass',
        roleId: 'r-client-admin',
      }),
      params('org-1')
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('rejects platform-role assignment by a non-platform caller', async () => {
    const { createMembership } = await import('@/lib/memberships/service');
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: 'org-1' } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue(platformRole as never);
    await expect(
      createMembership(clientAdminCtx(), 'org-1', {
        userId: 'u2',
        roleId: 'r-super',
      })
    ).rejects.toThrow('platform roles');
    expect(prisma.organizationMembership.create).not.toHaveBeenCalled();
  });

  it('rejects a non-existent role', async () => {
    const { createMembership } = await import('@/lib/memberships/service');
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1' } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue(null);
    await expect(
      createMembership(platformCtx(), 'org-1', { userId: 'u2', roleId: 'missing' })
    ).rejects.toThrow('Role not found');
  });

  it('rejects weak passwords when creating a new user', async () => {
    const { createMembership } = await import('@/lib/memberships/service');
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1' } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue(clientRole as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(
      createMembership(platformCtx(), 'org-1', {
        name: 'Jane',
        email: 'jane@acme.com',
        password: 'weak',
        roleId: 'r-client-admin',
      })
    ).rejects.toThrow('Password');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid membership status on create', async () => {
    const { createMembership } = await import('@/lib/memberships/service');
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1' } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue(clientRole as never);
    await expect(
      createMembership(platformCtx(), 'org-1', { userId: 'u2', roleId: 'r-client-admin', status: 'BANANA' })
    ).rejects.toThrow('Invalid membership status');
  });

  it('confines a client admin to their own organization', async () => {
    const { createMembership } = await import('@/lib/memberships/service');
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
    await expect(
      createMembership(clientAdminCtx('org-1'), 'org-2', { userId: 'u2', roleId: 'r-client-admin' })
    ).rejects.toThrow();
    expect(prisma.organizationMembership.create).not.toHaveBeenCalled();
  });
});

describe('membership status transitions', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockExistingMembership() {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'org-1' } as never);
    vi.mocked(prisma.organizationMembership.findFirst).mockResolvedValue({
      id: 'm1',
      organizationId: 'org-1',
      userId: 'u2',
      status: 'PENDING',
    } as never);
    vi.mocked(prisma.organizationMembership.update).mockResolvedValue({ id: 'm1', status: 'ACTIVE' } as never);
  }

  it('platform admin activates a pending membership', async () => {
    const { updateMembershipStatus } = await import('@/lib/memberships/service');
    mockExistingMembership();
    const result = await updateMembershipStatus(platformCtx(), 'org-1', 'm1', 'ACTIVE');
    expect(result.status).toBe('ACTIVE');
    expect(prisma.organizationMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } })
    );
  });

  it('rejects an invalid status transition', async () => {
    const { updateMembershipStatus } = await import('@/lib/memberships/service');
    mockExistingMembership();
    await expect(updateMembershipStatus(platformCtx(), 'org-1', 'm1', 'BANANA')).rejects.toThrow(
      'Invalid membership status'
    );
    expect(prisma.organizationMembership.update).not.toHaveBeenCalled();
  });

  it('a user without a session cannot reach the status endpoint', async () => {
    const { PATCH } = await import('@/app/api/admin/organizations/[id]/members/[membershipId]/status/route');
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await PATCH(
      jsonRequest('https://app.shivaksatechnology.com/api/admin/organizations/org-1/members/m1/status', { status: 'ACTIVE' }, 'PATCH'),
      params('org-1', 'm1')
    );
    expect(res.status).toBe(401);
  });

  it('a client admin from another organization cannot activate the membership', async () => {
    const { updateMembershipStatus } = await import('@/lib/memberships/service');
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
    await expect(
      updateMembershipStatus(clientAdminCtx('org-2'), 'org-1', 'm1', 'ACTIVE')
    ).rejects.toThrow();
  });

  it('platform admin can reassign a member to a client role', async () => {
    const { updateMembershipRole } = await import('@/lib/memberships/service');
    mockExistingMembership();
    vi.mocked(prisma.role.findUnique).mockResolvedValue({
      id: 'r-viewer',
      name: 'CLIENT_VIEWER',
      permissions: [{ permission: { key: 'voip:read' } }],
    } as never);
    await updateMembershipRole(platformCtx(), 'org-1', 'm1', 'r-viewer');
    expect(prisma.organizationMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { roleId: 'r-viewer' } })
    );
  });
});

describe('admin roles endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only client-assignable roles to a platform admin', async () => {
    const { GET } = await import('@/app/api/admin/roles/route');
    vi.mocked(getCurrentUser).mockResolvedValue(platformCtx());
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { id: 'r1', name: 'CLIENT_ADMIN', description: 'desc' },
    ] as never);
    const res = await GET(new NextRequest('https://app.shivaksatechnology.com/api/admin/roles'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { in: expect.arrayContaining(['CLIENT_ADMIN', 'CLIENT_VIEWER']) } },
      })
    );
    expect(json.data[0].name).toBe('CLIENT_ADMIN');
  });

  it('rejects a CLIENT_ADMIN listing assignable roles', async () => {
    const { GET } = await import('@/app/api/admin/roles/route');
    vi.mocked(getCurrentUser).mockResolvedValue(clientAdminCtx());
    const res = await GET(new NextRequest('https://app.shivaksatechnology.com/api/admin/roles'));
    expect(res.status).toBe(403);
  });
});
