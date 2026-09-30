import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/auth';
import {
  GET as listRoutePoliciesApi,
  POST as createRoutePolicyApi,
} from '@/app/api/voip/admin/route-policies/route';
import {
  RoutePolicyAuthorizationError,
  createRoutePolicy,
  findApplicableRoutePolicies,
  listRoutePolicies,
  updateRoutePolicy,
} from '@/lib/voip/services/route-policies';
import { DestinationType } from '@/lib/voip/constants';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

vi.mock('@/lib/auth/auth', () => ({
  getCurrentUser: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

const operationsCtx = {
  user: { id: 'ops-1', name: 'Operations', email: 'ops@example.com', isSuperAdmin: false },
  membership: { id: 'm-1', organizationId: 'org-1', roleId: 'r-ops', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Tenant One', slug: 'tenant-one' },
  role: { id: 'r-ops', name: 'OPERATIONS_MANAGER' },
  permissions: ['carrier-route:read', 'carrier-route:write', 'carrier-route:manage'],
};

const clientCtx = {
  user: { id: 'client-1', name: 'Client', email: 'client@example.com', isSuperAdmin: false },
  membership: { id: 'm-client', organizationId: 'org-1', roleId: 'r-client', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Tenant One', slug: 'tenant-one' },
  role: { id: 'r-client', name: 'CLIENT_VOIP_SUPPORT' },
  permissions: [
    'voip:read:calls',
    'voip:write:calls',
    'voip:read:sip',
    'voip:read:numbers',
    'wallet:read',
  ],
};

function makeCarrier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'carrier-1',
    organizationId: null,
    name: 'Private Carrier',
    code: 'private-carrier',
    type: 'SIP_GATEWAY',
    enabled: true,
    status: 'ACTIVE',
    authenticationType: 'IP_AUTH',
    remoteHost: '203.0.113.20',
    remotePort: 5060,
    transport: 'UDP',
    localHost: null,
    localPort: null,
    techPrefix: '99999',
    codecs: ['ulaw'],
    maxChannels: 100,
    maxCps: 10,
    billingIncrementSeconds: 60,
    minimumBillableSeconds: 60,
    defaultCallerId: '+14157040768',
    cliMode: 'FIXED',
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  const carrier = (overrides.carrier as ReturnType<typeof makeCarrier>) ?? makeCarrier();
  return {
    id: 'policy-1',
    organizationId: null,
    countryIso: 'GR',
    destinationType: DestinationType.ALL,
    carrierId: carrier.id,
    priority: 1,
    enabled: true,
    maxCpsOverride: null,
    maxChannelsOverride: null,
    cliProfileId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    carrier,
    cliProfile: null,
    ...overrides,
  };
}

describe('carrier route policy service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).auditLog = { create: vi.fn().mockResolvedValue({}) };
  });

  it('creates a normalized route policy with server-managed carrier and CLI references', async () => {
    const carrier = makeCarrier();
    const created = makePolicy({ countryIso: 'GR', priority: 2 });
    (prisma as any).carrier = { findUnique: vi.fn().mockResolvedValue(carrier) };
    (prisma as any).carrierCliProfile = { findUnique: vi.fn() };
    (prisma as any).carrierRoutePolicy = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(created),
    };

    const result = await createRoutePolicy(operationsCtx as never, {
      organizationId: 'org-1',
      countryIso: 'gr',
      destinationType: DestinationType.ALL,
      carrierId: carrier.id,
      priority: 2,
      maxCpsOverride: 5,
      maxChannelsOverride: 20,
    });

    expect(result).toBe(created);
    expect((prisma as any).carrierRoutePolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          countryIso: 'GR',
          carrierId: carrier.id,
          priority: 2,
          maxCpsOverride: 5,
          maxChannelsOverride: 20,
        }),
      })
    );
  });

  it('orders exact destination type first and then lowest numeric priority', async () => {
    const mobileLater = makePolicy({
      id: 'mobile-2',
      destinationType: DestinationType.MOBILE,
      priority: 2,
    });
    const genericFirst = makePolicy({
      id: 'generic-1',
      destinationType: DestinationType.ALL,
      priority: 1,
    });
    const mobileFirst = makePolicy({
      id: 'mobile-1',
      destinationType: DestinationType.MOBILE,
      priority: 1,
    });
    (prisma as any).carrierRoutePolicy = {
      findMany: vi.fn().mockResolvedValue([genericFirst, mobileLater, mobileFirst]),
    };

    const policies = await findApplicableRoutePolicies({
      organizationId: 'org-1',
      countryIso: 'GR',
      destinationType: DestinationType.MOBILE,
    });

    expect(policies.map((policy) => policy.id)).toEqual(['mobile-1', 'mobile-2', 'generic-1']);
  });

  it('excludes disabled, wrong-country, wrong-type, and suspended-carrier policies', async () => {
    const eligible = makePolicy({ id: 'eligible' });
    (prisma as any).carrierRoutePolicy = {
      findMany: vi
        .fn()
        .mockResolvedValue([
          eligible,
          makePolicy({ id: 'disabled', enabled: false }),
          makePolicy({ id: 'wrong-country', countryIso: 'US' }),
          makePolicy({ id: 'wrong-type', destinationType: DestinationType.FIXED }),
          makePolicy({ id: 'disabled-carrier', carrier: makeCarrier({ enabled: false }) }),
          makePolicy({ id: 'suspended', carrier: makeCarrier({ status: 'SUSPENDED' }) }),
        ]),
    };

    const policies = await findApplicableRoutePolicies({
      organizationId: 'org-1',
      countryIso: 'GR',
      destinationType: DestinationType.MOBILE,
    });

    expect(policies.map((policy) => policy.id)).toEqual(['eligible']);
  });

  it('uses tenant policies instead of global policies and rejects cross-tenant carriers', async () => {
    const tenantPolicy = makePolicy({ id: 'tenant', organizationId: 'org-1' });
    const globalPolicy = makePolicy({ id: 'global', organizationId: null });
    const otherTenant = makePolicy({
      id: 'other',
      organizationId: 'org-2',
      carrier: makeCarrier({ organizationId: 'org-2' }),
    });
    (prisma as any).carrierRoutePolicy = {
      findMany: vi.fn().mockResolvedValue([globalPolicy, otherTenant, tenantPolicy]),
    };

    const policies = await findApplicableRoutePolicies({
      organizationId: 'org-1',
      countryIso: 'GR',
      destinationType: DestinationType.ALL,
    });

    expect(policies.map((policy) => policy.id)).toEqual(['tenant']);
  });

  it('prevents route administrators from listing another organization policies', async () => {
    (prisma as any).carrierRoutePolicy = { findMany: vi.fn(), create: vi.fn() };

    await expect(
      listRoutePolicies(operationsCtx as never, { organizationId: 'org-2' })
    ).rejects.toThrow(RoutePolicyAuthorizationError);
    expect((prisma as any).carrierRoutePolicy.findMany).not.toHaveBeenCalled();
  });

  it('updates priority and enabled state without changing tenant ownership', async () => {
    const carrier = makeCarrier();
    const existing = makePolicy({ organizationId: 'org-1' });
    (prisma as any).carrier = { findUnique: vi.fn().mockResolvedValue(carrier) };
    (prisma as any).carrierRoutePolicy = {
      findUnique: vi.fn().mockResolvedValue(existing),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ ...existing, priority: 3, enabled: false }),
    };

    await updateRoutePolicy(operationsCtx as never, existing.id, { priority: 3, enabled: false });

    expect((prisma as any).carrierRoutePolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existing.id },
        data: { priority: 3, enabled: false },
      })
    );
  });
});

describe('route policy API security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentUser.mockResolvedValue(clientCtx as never);
    (prisma as any).carrierRoutePolicy = { findMany: vi.fn(), create: vi.fn() };
  });

  it('does not allow CLIENT_VOIP_SUPPORT to retrieve route or carrier information', async () => {
    const response = await listRoutePoliciesApi(
      new NextRequest('http://localhost/api/voip/admin/route-policies')
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json).toEqual({ success: false, error: 'Forbidden' });
    expect((prisma as any).carrierRoutePolicy.findMany).not.toHaveBeenCalled();
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain('Private Carrier');
    expect(serialized).not.toContain('203.0.113.20');
    expect(serialized).not.toContain('99999');
  });

  it('does not allow CLIENT_VOIP_SUPPORT to create or select a route policy', async () => {
    const response = await createRoutePolicyApi(
      new NextRequest('http://localhost/api/voip/admin/route-policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          countryIso: 'GR',
          destinationType: 'ALL',
          carrierId: 'attacker-selected-carrier',
          priority: 1,
        }),
      })
    );

    expect(response.status).toBe(403);
    expect((prisma as any).carrierRoutePolicy.create).not.toHaveBeenCalled();
  });
});
