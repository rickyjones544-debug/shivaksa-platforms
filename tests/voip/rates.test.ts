import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { findBestRate, findMatchingRates } from '@/lib/voip/services/rates';
import { normalizeDestination } from '@/lib/voip/services/normalization';
import { DestinationType, CarrierStatus } from '@/lib/voip/constants';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const carrierBase = {
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
  cliMode: 'PASS_THROUGH',
  remoteHost: '38.65.82.55',
  remotePort: 5060,
  localHost: null,
  localPort: null,
  techPrefix: '78542',
  maxChannels: 100,
  maxCps: 10,
  defaultCallerId: null,
  notes: null,
  organizationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function makeRate(overrides: Record<string, unknown>) {
  return {
    id: `rate-${Math.random().toString(36).slice(2)}`,
    carrierId: carrierBase.id,
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
    carrier: carrierBase,
    ...overrides,
  };
}

describe('Carrier rate lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches the longest prefix', async () => {
    const rates = [
      makeRate({ prefix: '30', rate: new Prisma.Decimal('0.020'), country: 'GR', destinationType: DestinationType.ALL }),
      makeRate({ prefix: '306', rate: new Prisma.Decimal('0.018'), country: 'GR', destinationType: DestinationType.ALL }),
    ];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const best = await findBestRate({ destination, organizationId: 'org-1' });

    expect(best).not.toBeNull();
    expect(best?.prefix).toBe('306');
    expect(best?.rate.toString()).toBe('0.018');
  });

  it('prefers an exact destination-type match over generic ALL', async () => {
    const rates = [
      makeRate({ prefix: '30', destinationType: DestinationType.ALL, rate: '0.020' }),
      makeRate({ prefix: '30', destinationType: DestinationType.MOBILE, rate: '0.018' }),
    ];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678'); // mobile
    const best = await findBestRate({ destination, organizationId: 'org-1' });

    expect(best?.destinationType).toBe(DestinationType.MOBILE);
    expect(best?.rate.toString()).toBe('0.018');
  });

  it('filters out disabled carriers', async () => {
    const disabledCarrier = { ...carrierBase, enabled: false };
    const rates = [makeRate({ carrier: disabledCarrier, prefix: '30' })];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const matches = await findMatchingRates({ destination, organizationId: 'org-1' });

    expect(matches).toHaveLength(0);
  });

  it('respects tenant isolation for organization-scoped carriers', async () => {
    const scopedCarrier = { ...carrierBase, organizationId: 'org-2' };
    const rates = [makeRate({ carrier: scopedCarrier, prefix: '30' })];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const matches = await findMatchingRates({ destination, organizationId: 'org-1' });

    expect(matches).toHaveLength(0);
  });

  it('allows platform-wide carriers for any tenant', async () => {
    const rates = [makeRate({ prefix: '30' })];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const matches = await findMatchingRates({ destination, organizationId: 'org-1' });

    expect(matches).toHaveLength(1);
  });

  it('returns null when no rate matches', async () => {
    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue([]) };

    const destination = normalizeDestination('+306912345678');
    const best = await findBestRate({ destination, organizationId: 'org-1' });

    expect(best).toBeNull();
  });

  it('selects the currently effective rate among multiple effective-dated rows', async () => {
    const rates = [
      makeRate({
        prefix: '30',
        rate: '0.018',
        effectiveFrom: new Date('2026-09-01'),
        effectiveTo: new Date('2026-10-01'),
      }),
      makeRate({
        prefix: '30',
        rate: '0.019',
        effectiveFrom: new Date('2026-10-01'),
        effectiveTo: null,
      }),
    ];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const best = await findBestRate({
      destination,
      organizationId: 'org-1',
      effectiveAt: new Date('2026-10-15'),
    });

    expect(best?.rate.toString()).toBe('0.019');
  });

  it('selects the older rate when queried within its effective window', async () => {
    const rates = [
      makeRate({
        prefix: '30',
        rate: '0.018',
        effectiveFrom: new Date('2026-09-01'),
        effectiveTo: new Date('2026-10-01'),
      }),
      makeRate({
        prefix: '30',
        rate: '0.019',
        effectiveFrom: new Date('2026-10-01'),
        effectiveTo: null,
      }),
    ];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const best = await findBestRate({
      destination,
      organizationId: 'org-1',
      effectiveAt: new Date('2026-09-15'),
    });

    expect(best?.rate.toString()).toBe('0.018');
  });

  it('filters out disabled rates', async () => {
    const rates = [
      makeRate({ prefix: '30', rate: '0.020', enabled: true }),
      makeRate({ prefix: '30', rate: '0.018', enabled: false }),
    ];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const best = await findBestRate({ destination, organizationId: 'org-1' });

    expect(best?.rate.toString()).toBe('0.020');
  });

  it('filters out expired rates', async () => {
    const rates = [
      makeRate({
        prefix: '30',
        rate: '0.018',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-02-01'),
      }),
    ];

    (prisma as any).carrierRate = { findMany: vi.fn().mockResolvedValue(rates) };

    const destination = normalizeDestination('+306912345678');
    const best = await findBestRate({
      destination,
      organizationId: 'org-1',
      effectiveAt: new Date('2026-03-01'),
    });

    expect(best).toBeNull();
  });
});
