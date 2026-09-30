import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { selectRoute, resetCpsBucket, RoutingError } from '@/lib/voip/services/routing';
import { DestinationType, CarrierStatus, CliMode } from '@/lib/voip/constants';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const sipAccount = {
  id: 'sip-1',
  organizationId: 'org-1',
  username: 'user1',
  domain: 'sip.example.com',
  status: 'ACTIVE',
  callerId: '+15551234567',
  maxConcurrentCalls: 1,
  passwordCipher: 'cipher',
  passwordTag: 'tag',
  passwordIv: 'iv',
  providerConnectionId: null,
  providerConfig: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCarrier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'carrier-1',
    code: 'teloz',
    name: 'Teloz',
    type: 'SIP_GATEWAY',
    enabled: true,
    status: CarrierStatus.TEST,
    authenticationType: 'IP_AUTH',
    transport: 'UDP',
    codecs: [],
    billingIncrementSeconds: 1,
    minimumBillableSeconds: 1,
    cliMode: CliMode.PASS_THROUGH,
    remoteHost: '38.65.82.55',
    remotePort: 5060,
    localHost: '82.152.141.69',
    localPort: null,
    techPrefix: '78542',
    maxChannels: 100,
    maxCps: 10,
    defaultCallerId: null,
    notes: null,
    organizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rate-1',
    carrierId: 'carrier-1',
    prefix: '30',
    country: 'GR',
    destinationType: DestinationType.ALL,
    rate: new Prisma.Decimal('0.018'),
    billingIncrementSeconds: 1,
    minimumBillableSeconds: 1,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    priority: 0,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    carrier: makeCarrier(),
    ...overrides,
  };
}

function makePolicy(carrier = makeCarrier(), overrides: Record<string, unknown> = {}) {
  return {
    id: `policy-${carrier.id}`,
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

function mockPolicies(...policies: ReturnType<typeof makePolicy>[]) {
  (prisma as any).carrierRoutePolicy = { findMany: vi.fn().mockResolvedValue(policies) };
}

describe('Routing engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCpsBucket();
  });

  afterEach(() => {
    resetCpsBucket();
  });

  it('selects a SIP gateway carrier and applies tech prefix', async () => {
    const carrier = makeCarrier();
    const rate = makeRate();

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([rate]) };
    mockPolicies(makePolicy(carrier));
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };

    const route = await selectRoute({
      organizationId: 'org-1',
      destination: '+306912345678',
      sipAccount,
    });

    expect(route.carrier.code).toBe('teloz');
    expect(route.rate.prefix).toBe('30');
    expect(route.dialString).toBe('78542306912345678');
    expect(route.normalized.countryIso).toBe('GR');
    expect(route.callerId).toBe('+15551234567');
  });

  it('selects the carrier with the lowest route-policy priority', async () => {
    const preferredCarrier = makeCarrier({ id: 'carrier-2', code: 'teloz2' });
    const preferredRate = makeRate({ carrierId: 'carrier-2', carrier: preferredCarrier });
    const otherCarrier = makeCarrier({ id: 'carrier-1', code: 'teloz' });
    const otherRate = makeRate({ carrier: otherCarrier });

    (prisma as any).carrierRate = {
      findMany: vi.fn().mockResolvedValue([preferredRate, otherRate]),
    };
    mockPolicies(
      makePolicy(otherCarrier, { priority: 2 }),
      makePolicy(preferredCarrier, { priority: 1 })
    );
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };

    const route = await selectRoute({
      organizationId: 'org-1',
      destination: '+306912345678',
      sipAccount,
    });

    expect(route.carrier.code).toBe('teloz2');
  });

  it('falls back to another carrier when the preferred carrier is disabled', async () => {
    const disabledCarrier = makeCarrier({ id: 'c-disabled', code: 'preferred', enabled: false });
    const disabledRate = makeRate({ carrierId: 'c-disabled', carrier: disabledCarrier });
    const fallbackCarrier = makeCarrier({ id: 'c-fallback', code: 'fallback' });
    const fallbackRate = makeRate({ carrierId: 'c-fallback', carrier: fallbackCarrier });

    (prisma as any).carrierRate = {
      findMany: vi.fn().mockResolvedValue([disabledRate, fallbackRate]),
    };
    mockPolicies(makePolicy(fallbackCarrier));
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };

    const route = await selectRoute({
      organizationId: 'org-1',
      destination: '+306912345678',
      sipAccount,
    });

    expect(route.carrier.code).toBe('fallback');
  });

  it('falls back to another carrier when the preferred carrier has no matching rate', async () => {
    const preferredCarrier = makeCarrier({ id: 'c-preferred', code: 'preferred' });
    const fallbackCarrier = makeCarrier({ id: 'c-fallback', code: 'fallback' });
    const fallbackRate = makeRate({ carrierId: 'c-fallback', carrier: fallbackCarrier });

    (prisma as any).carrierRate = {
      findMany: vi.fn().mockResolvedValue([fallbackRate]),
    };
    mockPolicies(
      makePolicy(preferredCarrier, { priority: 1 }),
      makePolicy(fallbackCarrier, { priority: 2 })
    );
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };

    const route = await selectRoute({
      organizationId: 'org-1',
      destination: '+306912345678',
      sipAccount,
    });

    expect(route.carrier.code).toBe('fallback');
  });

  it('falls back when the preferred carrier is over capacity', async () => {
    const fullCarrier = makeCarrier({ id: 'c-full', code: 'full', maxChannels: 1 });
    const fullRate = makeRate({ carrierId: 'c-full', carrier: fullCarrier });
    const fallbackCarrier = makeCarrier({ id: 'c-fallback', code: 'fallback' });
    const fallbackRate = makeRate({ carrierId: 'c-fallback', carrier: fallbackCarrier });

    (prisma as any).carrierRate = {
      findMany: vi.fn().mockResolvedValue([fullRate, fallbackRate]),
    };
    mockPolicies(
      makePolicy(fullCarrier, { priority: 1 }),
      makePolicy(fallbackCarrier, { priority: 2 })
    );
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(1) }; // full carrier at capacity

    const route = await selectRoute({
      organizationId: 'org-1',
      destination: '+306912345678',
      sipAccount,
    });

    expect(route.carrier.code).toBe('fallback');
  });

  it('throws when no route is available', async () => {
    mockPolicies();
    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([]) };

    await expect(
      selectRoute({
        organizationId: 'org-1',
        destination: '+306912345678',
        sipAccount,
      })
    ).rejects.toThrow(RoutingError);
  });

  it('rejects carriers over channel capacity when no fallback exists', async () => {
    const carrier = makeCarrier({ maxChannels: 1 });
    const rate = makeRate({ carrier });

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([rate]) };
    mockPolicies(makePolicy(carrier));
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(1) };

    await expect(
      selectRoute({
        organizationId: 'org-1',
        destination: '+306912345678',
        sipAccount,
      })
    ).rejects.toThrow('at capacity');
  });

  it('enforces maxCps and rejects calls exceeding the per-second rate', async () => {
    const carrier = makeCarrier({ maxCps: 1 });
    const rate = makeRate({ carrier });

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([rate]) };
    mockPolicies(makePolicy(carrier));
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };

    await selectRoute({ organizationId: 'org-1', destination: '+306912345678', sipAccount });
    await expect(
      selectRoute({ organizationId: 'org-1', destination: '+306912345678', sipAccount })
    ).rejects.toThrow('CPS');
  });

  it('enforces a route-policy channel override below the carrier limit', async () => {
    const carrier = makeCarrier({ maxChannels: 100 });
    const rate = makeRate({ carrier });

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([rate]) };
    mockPolicies(makePolicy(carrier, { maxChannelsOverride: 1 }));
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(1) };

    await expect(
      selectRoute({ organizationId: 'org-1', destination: '+306912345678', sipAccount })
    ).rejects.toThrow('capacity');
  });

  it('enforces a route-policy CPS override below the carrier limit', async () => {
    const carrier = makeCarrier({ maxCps: 10 });
    const rate = makeRate({ carrier });

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([rate]) };
    mockPolicies(makePolicy(carrier, { maxCpsOverride: 1 }));
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };

    await selectRoute({ organizationId: 'org-1', destination: '+306912345678', sipAccount });
    await expect(
      selectRoute({ organizationId: 'org-1', destination: '+306912345678', sipAccount })
    ).rejects.toThrow('CPS');
  });

  it('selects caller ID from the route-policy CLI profile server-side', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.POOL });
    const rate = makeRate({ carrier });

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([rate]) };
    mockPolicies(makePolicy(carrier, { cliProfileId: 'cli-profile-1' }));
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };
    (prisma as any).carrierCliProfile = {
      findFirst: vi.fn().mockResolvedValue({
        id: 'cli-profile-1',
        defaultCli: '+14157040768',
        entries: [],
      }),
    };

    const route = await selectRoute({
      organizationId: 'org-1',
      destination: '+306912345678',
      sipAccount,
    });

    expect(route.callerId).toBe('+14157040768');
    expect((prisma as any).carrierCliProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cli-profile-1', carrierId: carrier.id } })
    );
  });

  it('uses route-policy priority instead of carrier-rate priority', async () => {
    const highPriorityCarrier = makeCarrier({ id: 'carrier-high', code: 'high' });
    const highRate = makeRate({
      carrierId: 'carrier-high',
      carrier: highPriorityCarrier,
      priority: 10,
    });
    const lowPriorityCarrier = makeCarrier({ id: 'carrier-low', code: 'low' });
    const lowRate = makeRate({
      carrierId: 'carrier-low',
      carrier: lowPriorityCarrier,
      priority: 0,
    });

    (prisma as any).carrierRate = {
      findMany: vi.fn().mockResolvedValue([lowRate, highRate]),
    };
    mockPolicies(
      makePolicy(highPriorityCarrier, { priority: 1 }),
      makePolicy(lowPriorityCarrier, { priority: 2 })
    );
    (prisma as any).voipCall = { count: vi.fn().mockResolvedValue(0) };

    const route = await selectRoute({
      organizationId: 'org-1',
      destination: '+306912345678',
      sipAccount,
    });

    expect(route.carrier.code).toBe('high');
  });
});
