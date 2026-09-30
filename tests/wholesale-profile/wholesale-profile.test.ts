import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  getPublishedWholesaleProfile,
  getActiveWholesaleProfile,
  upsertWholesaleProfile,
  toProviderWholesaleProfileDto,
  WholesaleProfileError,
} from '@/lib/wholesale-profile/services/profile';
import { getRolePermissions } from '@/lib/rbac/roles';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

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

const activeProfile = {
  id: 'wp1',
  organizationId: 'org-1',
  requirementSetId: 'rs1',
  publishedVersionNumber: 1,
  status: 'ACTIVE',
  title: 'Wholesale Voice Partnership — Shivaksa Technologies LLC',
  subtitle: 'International wholesale termination · carrier relationships · traffic coordination',
  createdById: 'internal-user-id',
  updatedById: 'internal-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publishedVersion = {
  id: 'rv1',
  requirementSetId: 'rs1',
  versionNumber: 1,
  status: 'PUBLISHED',
  createdById: 'internal-user-id',
};

const publishableSections = [
  {
    id: 's1',
    requirementVersionId: 'rv1',
    key: 'COMPANY_PROFILE',
    title: 'Company Profile',
    description: null,
    sortOrder: 10,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: { body: 'Shivaksa Technologies LLC is a U.S.-registered technology and communications company.' },
    createdAt: new Date(),
  },
  {
    id: 's2',
    requirementVersionId: 'rv1',
    key: 'DESTINATIONS',
    title: 'Target Destinations',
    description: null,
    sortOrder: 40,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: { destinations: [{ name: 'Greece', iso2: 'GR' }] },
    createdAt: new Date(),
  },
];

function mockPublishedResolution(overrides: {
  profile?: object | null;
  version?: object | null;
  sections?: object[];
} = {}) {
  (prisma as any).wholesaleProfile = {
    findUnique: vi.fn().mockResolvedValue(
      overrides.profile === undefined ? activeProfile : overrides.profile
    ),
  };
  (prisma as any).requirementVersion = {
    findUnique: vi.fn().mockResolvedValue(
      overrides.version === undefined ? publishedVersion : overrides.version
    ),
  };
  (prisma as any).requirementVersionSection = {
    findMany: vi.fn().mockResolvedValue(
      overrides.sections === undefined ? publishableSections : overrides.sections
    ),
  };
}

describe('Wholesale Profile — provider-safe boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).auditLog = { create: vi.fn() };
  });

  it('Test 1: published profile returns the publishable sections via explicit DTO', async () => {
    mockPublishedResolution();
    const dto = await getPublishedWholesaleProfile('org-1');

    expect(dto).not.toBeNull();
    expect(dto!.title).toBe(activeProfile.title);
    expect(dto!.subtitle).toBe(activeProfile.subtitle);
    expect(dto!.sections).toHaveLength(2);
    expect(dto!.sections[0].key).toBe('COMPANY_PROFILE');
    // The resolver must query only PUBLISHABLE sections of that version
    expect((prisma as any).requirementVersionSection.findMany).toHaveBeenCalledWith({
      where: { requirementVersionId: 'rv1', visibility: 'PUBLISHABLE' },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('Test 2: INTERNAL sections are filtered server-side, never reaching the DTO', async () => {
    mockPublishedResolution();
    await getPublishedWholesaleProfile('org-1');

    // The DB query itself excludes INTERNAL — the DTO can never contain them
    const where = (prisma as any).requirementVersionSection.findMany.mock.calls[0][0].where;
    expect(where.visibility).toBe('PUBLISHABLE');
    expect(JSON.stringify(where)).not.toContain('INTERNAL');
  });

  it('Test 3: a DRAFT requirement version is never returned', async () => {
    mockPublishedResolution({ version: { ...publishedVersion, status: 'DRAFT' } });
    expect(await getPublishedWholesaleProfile('org-1')).toBeNull();
  });

  it('Test 4: a SUPERSEDED requirement version is never returned', async () => {
    mockPublishedResolution({ version: { ...publishedVersion, status: 'SUPERSEDED' } });
    expect(await getPublishedWholesaleProfile('org-1')).toBeNull();
  });

  it('Test 5: an ARCHIVED wholesale profile yields no provider profile', async () => {
    mockPublishedResolution({ profile: { ...activeProfile, status: 'ARCHIVED' } });
    expect(await getPublishedWholesaleProfile('org-1')).toBeNull();
    // version must not even be queried
    expect((prisma as any).requirementVersion.findUnique).not.toHaveBeenCalled();
  });

  it('Test 6: provider DTO contains no internal or sensitive fields', async () => {
    mockPublishedResolution();
    const dto = await getPublishedWholesaleProfile('org-1');

    // Exact allowed shape — nothing else
    expect(Object.keys(dto!).sort()).toEqual(['sections', 'subtitle', 'title']);
    for (const s of dto!.sections) {
      expect(Object.keys(s).sort()).toEqual([
        'content', 'description', 'isRequired', 'key', 'sortOrder', 'title',
      ]);
    }

    // No internal/sensitive field names may appear anywhere in the DTO,
    // including inside section content objects.
    const serialized = JSON.stringify(dto);
    for (const forbiddenKey of [
      '"id"', 'organizationId', 'requirementSetId', 'requirementVersionId',
      'providerId', 'provider_id', 'carrierId', 'carrier_id', 'rateId',
      'wholesaleRate', 'wholesaleCost', 'providerCost', 'grossProfit', 'margin',
      'credential', 'passwordHash', 'passwordCipher', 'ProviderNote',
      'ProviderTask', 'ProviderIssue', 'invoice', 'payment', 'balance',
      'wallet', 'routePolicy', 'route_policy', 'auditLog', 'createdById',
      'updatedById', 'publishedById', 'lifecycleStage', 'visibility',
      'status', 'sipAccount', 'voipCall',
    ]) {
      expect(serialized, `DTO must not contain "${forbiddenKey}"`).not.toContain(forbiddenKey);
    }
  });

  it('Test 7: organization isolation — profile resolution is keyed to the org id only', async () => {
    mockPublishedResolution({ profile: null });
    expect(await getPublishedWholesaleProfile('org-2')).toBeNull();
    expect((prisma as any).wholesaleProfile.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-2' },
    });
  });

  it('Test 8: the resolver only uses the profile published pointer, never caller input', async () => {
    mockPublishedResolution();
    // The function signature accepts only an organizationId — there is no
    // parameter through which a caller could inject a version id.
    expect(getPublishedWholesaleProfile.length).toBe(1);
    await getPublishedWholesaleProfile('org-1');
    expect((prisma as any).requirementVersion.findUnique).toHaveBeenCalledWith({
      where: {
        requirementSetId_versionNumber: {
          requirementSetId: 'rs1',
          versionNumber: 1, // profile.publishedVersionNumber, not caller input
        },
      },
    });
  });

  it('Test 9: the provider resolver never returns a raw Prisma model', async () => {
    mockPublishedResolution();
    const dto = await getPublishedWholesaleProfile('org-1');
    // Raw rows would expose id, organizationId, createdById, timestamps, status
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('organizationId');
    for (const s of dto!.sections) {
      expect(s).not.toHaveProperty('id');
      expect(s).not.toHaveProperty('visibility');
      expect(s).not.toHaveProperty('requirementVersionId');
    }
  });

  it('missing published version pointer fails closed', async () => {
    mockPublishedResolution({ profile: { ...activeProfile, publishedVersionNumber: null } });
    expect(await getPublishedWholesaleProfile('org-1')).toBeNull();
  });

  it('empty publishable section set fails closed', async () => {
    mockPublishedResolution({ sections: [] });
    expect(await getPublishedWholesaleProfile('org-1')).toBeNull();
  });

  describe('Internal management RBAC', () => {
    it('OPERATIONS_MANAGER can manage profiles; INTERNAL_STAFF read-only; CLIENT_* denied', () => {
      expect(hasPermission(opsCtx, 'wholesale-profile', 'publish')).toBe(true);
      expect(hasPermission(staffCtx, 'wholesale-profile', 'read')).toBe(true);
      expect(hasPermission(staffCtx, 'wholesale-profile', 'write')).toBe(false);
      expect(hasPermission(clientCtx, 'wholesale-profile', 'read')).toBe(false);
    });

    it('management functions require permission server-side', async () => {
      await expect(getActiveWholesaleProfile(clientCtx)).rejects.toThrow(WholesaleProfileError);
      await expect(
        upsertWholesaleProfile(clientCtx, { requirementSetId: 'rs1', title: 'x' })
      ).rejects.toThrow(WholesaleProfileError);
    });

    it('rejects pointing a profile at a non-PUBLISHED version', async () => {
      (prisma as any).requirementSet = {
        findUnique: vi.fn().mockResolvedValue({ id: 'rs1', organizationId: 'org-1' }),
      };
      (prisma as any).requirementVersion = {
        findUnique: vi.fn().mockResolvedValue({ id: 'rv2', status: 'DRAFT' }),
      };
      (prisma as any).wholesaleProfile = { upsert: vi.fn() };

      await expect(
        upsertWholesaleProfile(opsCtx, {
          requirementSetId: 'rs1',
          title: 'x',
          publishedVersionNumber: 2,
        })
      ).rejects.toThrow('PUBLISHED');
      expect((prisma as any).wholesaleProfile.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Phase 2 regression', () => {
    it('Test 10: Requirements Center permissions and roles remain intact', () => {
      expect(hasPermission(opsCtx, 'requirements', 'publish')).toBe(true);
      expect(hasPermission(staffCtx, 'requirements', 'read')).toBe(true);
      expect(hasPermission(clientCtx, 'requirements', 'read')).toBe(false);
      expect(getRolePermissions('CARRIER_MANAGER')).toContain('requirements:write');
    });
  });
});
