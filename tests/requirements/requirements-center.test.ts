import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  createRequirementSet,
  upsertRequirementSection,
  createRequirementVersion,
  getRequirementVersion,
  listRequirementSets,
  setRequirementVersionStatus,
  RequirementAuthorizationError,
} from '@/lib/requirements/services/requirements';
import { getRolePermissions } from '@/lib/rbac/roles';
import { hasPermission } from '@/lib/rbac/authorization';
import { isValidRequirementSectionKey } from '@/lib/requirements/constants';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const superAdminCtx: AuthenticatedContext = {
  user: { id: 'u1', name: 'Admin', email: 'admin@example.com', isSuperAdmin: true },
  membership: null,
  organization: { id: 'org-1', name: 'Shivaksa', slug: 'shivaksa' },
  role: null,
  permissions: [],
};

const opsCtx: AuthenticatedContext = {
  user: { id: 'u2', name: 'Ops', email: 'ops@example.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Shivaksa', slug: 'shivaksa' },
  role: { id: 'r1', name: 'OPERATIONS_MANAGER' },
  permissions: getRolePermissions('OPERATIONS_MANAGER'),
};

const carrierManagerCtx: AuthenticatedContext = {
  ...opsCtx,
  user: { id: 'u3', name: 'CM', email: 'cm@example.com', isSuperAdmin: false },
  role: { id: 'r2', name: 'CARRIER_MANAGER' },
  permissions: getRolePermissions('CARRIER_MANAGER'),
};

const staffCtx: AuthenticatedContext = {
  ...opsCtx,
  user: { id: 'u4', name: 'Staff', email: 'staff@example.com', isSuperAdmin: false },
  role: { id: 'r3', name: 'INTERNAL_STAFF' },
  permissions: getRolePermissions('INTERNAL_STAFF'),
};

const clientCtx: AuthenticatedContext = {
  ...opsCtx,
  user: { id: 'u5', name: 'Client', email: 'client@example.com', isSuperAdmin: false },
  role: { id: 'r4', name: 'CLIENT_ADMIN' },
  permissions: getRolePermissions('CLIENT_ADMIN'),
};

function mockAudit() {
  (prisma as any).auditLog = { create: vi.fn() };
}

function mockSectionSet() {
  (prisma as any).requirementSet = {
    findUnique: vi.fn().mockResolvedValue({ id: 'rs1', organizationId: 'org-1' }),
  };
  (prisma as any).requirementSection = {
    upsert: vi.fn().mockImplementation((args) => ({ id: 'sec-1', ...args.create })),
  };
}

describe('Requirements Center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudit();
  });

  it('scopes requirement sets to the caller organization, ignoring supplied org ids', async () => {
    (prisma as any).requirementSet = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((args) => ({ id: 'rs1', ...args.data })),
    };

    const set = await createRequirementSet(opsCtx, {
      name: 'Shivaksa Wholesale Provider Requirements',
      organizationId: 'org-other',
    });

    expect(set.organizationId).toBe('org-1');
    expect((prisma as any).requirementSet.create.mock.calls[0][0].data.organizationId).toBe('org-1');
  });

  it('rejects a duplicate requirement set name within the same organization', async () => {
    (prisma as any).requirementSet = {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'existing', name: 'Shivaksa Wholesale Provider Requirements' }),
      create: vi.fn(),
    };

    await expect(
      createRequirementSet(opsCtx, { name: 'Shivaksa Wholesale Provider Requirements' })
    ).rejects.toThrow(RequirementAuthorizationError);
  });

  it('validates section keys at the application layer', () => {
    expect(isValidRequirementSectionKey('COMPANY_PROFILE')).toBe(true);
    expect(isValidRequirementSectionKey('CLI_ANI')).toBe(true);
    expect(isValidRequirementSectionKey('custom')).toBe(false);
    expect(isValidRequirementSectionKey('bad key')).toBe(false);
  });

  it('upserts a publishable section with structured JSON content', async () => {
    mockSectionSet();

    const section = await upsertRequirementSection(opsCtx, 'rs1', {
      key: 'TRAFFIC_PROFILE',
      title: 'Traffic Profile',
      visibility: 'PUBLISHABLE',
      content: { items: [{ key: 'traffic_type', values: ['WHOLESALE_INTERNATIONAL_VOICE_TERMINATION'] }] },
    });

    expect(section.visibility).toBe('PUBLISHABLE');
    expect((section.content as { items: { key: string }[] }).items[0].key).toBe('traffic_type');
    expect((prisma as any).requirementSection.upsert.mock.calls[0][0].where).toEqual({
      requirementSetId_key: { requirementSetId: 'rs1', key: 'TRAFFIC_PROFILE' },
    });
  });

  it('creates the next immutable version and snapshots live sections into it', async () => {
    (prisma as any).requirementSet = {
      findUnique: vi.fn().mockResolvedValue({ id: 'rs1', organizationId: 'org-1' }),
      update: vi.fn().mockResolvedValue({ id: 'rs1', currentVersion: 2 }),
    };
    (prisma as any).requirementSection = {
      findMany: vi.fn().mockResolvedValue([
        { key: 'COMPANY_PROFILE', title: 'Company', sortOrder: 10, visibility: 'PUBLISHABLE', isRequired: true, content: { body: 'x' }, description: null },
        { key: 'INTERNAL_STRATEGY', title: 'Internal', sortOrder: 99, visibility: 'INTERNAL', isRequired: false, content: null, description: null },
      ]),
    };
    (prisma as any).requirementVersion = {
      aggregate: vi.fn().mockResolvedValue({ _max: { versionNumber: 1 } }),
      create: vi.fn().mockResolvedValue({ id: 'rv2', versionNumber: 2 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'rv2', versionNumber: 2 }),
    };
    (prisma as any).requirementVersionSection = { createMany: vi.fn() };

    const version = await createRequirementVersion(opsCtx, 'rs1', { changeSummary: 'v2' });

    expect((prisma as any).requirementVersion.create.mock.calls[0][0].data.versionNumber).toBe(2);
    const snapshotRows = (prisma as any).requirementVersionSection.createMany.mock.calls[0][0].data;
    expect(snapshotRows).toHaveLength(2);
    expect(snapshotRows[0].requirementVersionId).toBe('rv2');
    expect(snapshotRows[1].visibility).toBe('INTERNAL');
    expect((prisma as any).requirementSet.update.mock.calls[0][0].data.currentVersion).toBe(2);
    expect(version?.versionNumber).toBe(2);
  });

  it('keeps historical versions independently addressable by (setId, versionNumber)', async () => {
    (prisma as any).requirementSet = {
      findUnique: vi.fn().mockResolvedValue({ id: 'rs1', organizationId: 'org-1' }),
    };
    (prisma as any).requirementVersion = {
      findUnique: vi.fn().mockResolvedValue({ id: 'rv1', versionNumber: 1 }),
    };

    await getRequirementVersion(opsCtx, 'rs1', 1);

    expect((prisma as any).requirementVersion.findUnique).toHaveBeenCalledWith({
      where: { requirementSetId_versionNumber: { requirementSetId: 'rs1', versionNumber: 1 } },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  it('publishing a version supersedes other published versions of the same set', async () => {
    (prisma as any).requirementSet = {
      findUnique: vi.fn().mockResolvedValue({ id: 'rs1', organizationId: 'org-1' }),
    };
    (prisma as any).requirementVersion = {
      findUnique: vi.fn().mockResolvedValue({ id: 'rv2', requirementSetId: 'rs1', versionNumber: 2 }),
      update: vi.fn().mockResolvedValue({ id: 'rv2', status: 'PUBLISHED' }),
      updateMany: vi.fn(),
    };

    await setRequirementVersionStatus(opsCtx, 'rv2', 'PUBLISHED');

    const supersede = (prisma as any).requirementVersion.updateMany.mock.calls[0][0];
    expect(supersede.where.status).toBe('PUBLISHED');
    expect(supersede.data.status).toBe('SUPERSEDED');
  });

  describe('RBAC', () => {
    it('allows SUPER_ADMIN and OPERATIONS_MANAGER full access including publish', () => {
      expect(hasPermission(superAdminCtx, 'requirements', 'publish')).toBe(true);
      expect(hasPermission(opsCtx, 'requirements', 'publish')).toBe(true);
      expect(hasPermission(opsCtx, 'requirements', 'manage')).toBe(true);
    });

    it('allows CARRIER_MANAGER to read and update but not publish or manage', () => {
      expect(hasPermission(carrierManagerCtx, 'requirements', 'read')).toBe(true);
      expect(hasPermission(carrierManagerCtx, 'requirements', 'write')).toBe(true);
      expect(hasPermission(carrierManagerCtx, 'requirements', 'publish')).toBe(false);
      expect(hasPermission(carrierManagerCtx, 'requirements', 'manage')).toBe(false);
    });

    it('gives INTERNAL_STAFF read-only access', () => {
      expect(hasPermission(staffCtx, 'requirements', 'read')).toBe(true);
      expect(hasPermission(staffCtx, 'requirements', 'write')).toBe(false);
      expect(hasPermission(staffCtx, 'requirements', 'publish')).toBe(false);
    });

    it('denies all requirements access to CLIENT_* and operational roles', async () => {
      expect(hasPermission(clientCtx, 'requirements', 'read')).toBe(false);
      expect(hasPermission(clientCtx, 'requirements', 'write')).toBe(false);
      for (const role of ['CLIENT_VIEWER', 'CLIENT_VOIP_SUPPORT', 'SUPERVISOR', 'BPO_AGENT', 'QA_MANAGER']) {
        const perms = getRolePermissions(role);
        expect(perms.some((p) => p.startsWith('requirements'))).toBe(false);
      }
    });

    it('enforces permissions server-side on service functions', async () => {
      await expect(listRequirementSets(clientCtx)).rejects.toThrow(RequirementAuthorizationError);
      await expect(
        createRequirementSet(clientCtx, { name: 'x' })
      ).rejects.toThrow(RequirementAuthorizationError);
    });
  });
});
