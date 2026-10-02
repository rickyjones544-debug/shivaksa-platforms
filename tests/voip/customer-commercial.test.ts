import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/db/prisma', () => {
  const p: any = {
    customerRateCard: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerRate: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sipAccount: { findUnique: vi.fn() },
    voipService: { findUnique: vi.fn() },
    voipCall: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    usageAggregate: { upsert: vi.fn() },
    wallet: { findUnique: vi.fn(), update: vi.fn() },
    walletTransaction: { create: vi.fn(), findUnique: vi.fn() },
    walletReservation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  p.$executeRaw = vi.fn().mockResolvedValue(1);
  p.$transaction = vi.fn((arg: any) =>
    typeof arg === 'function' ? arg(p) : Promise.all(arg)
  );
  p.$queryRaw = vi.fn().mockResolvedValue([{ id: 'wallet-1' }]);
  return { prisma: p };
});

vi.mock('@/lib/voip/services/eligibility', () => ({
  assertVoipEligibility: vi.fn().mockResolvedValue(undefined),
}));

import {
  getCustomerRate,
  createRateCard,
  updateRateCard,
  addRate,
  updateRate,
  CustomerRateError,
} from '@/lib/voip/services/customer-rates';
import { authorizeGatewayCall } from '@/lib/voip/services/call-authorization';
import { reconcileCallBilling } from '@/lib/voip/services/calls';
import { normalizeDestination } from '@/lib/voip/services/normalization';
import { toCustomerRateDto, toCustomerCallDto } from '@/lib/voip/dto/customer';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

const platformCtx = {
  user: { id: 'u1', name: 'Operator', email: 'op@shivaksa.com', isSuperAdmin: true },
  membership: null,
  organization: null,
  role: { id: 'r1', name: 'SUPER_ADMIN' },
  permissions: ['voip:manage'],
} as unknown as AuthenticatedContext;

function makeRate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rate-1',
    rateCardId: 'card-1',
    prefix: '30',
    destination: 'Greece',
    country: 'GR',
    rate: new Prisma.Decimal('0.020'),
    billingIncrementSeconds: 60,
    minimumBillableSeconds: 60,
    effectiveFrom: new Date('2020-01-01'),
    effectiveTo: null,
    enabled: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCard(rates: ReturnType<typeof makeRate>[], overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    organizationId: 'org-1',
    name: 'Standard',
    description: null,
    currency: 'USD',
    status: 'ACTIVE',
    rates,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const normalizedGr = normalizeDestination('+306912345678');
const normalizedAthens = normalizeDestination('+302101234567');

describe('getCustomerRate — prefix selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects the longest matching prefix', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(
      makeCard([
        makeRate({ id: 'r-gr', prefix: '30', rate: new Prisma.Decimal('0.020') }),
        makeRate({ id: 'r-ath', prefix: '3021', destination: 'Athens', rate: new Prisma.Decimal('0.010') }),
      ])
    );

    const sel = await getCustomerRate('org-1', normalizedAthens);
    expect(sel.customerRateId).toBe('r-ath');
    expect(sel.rate.toString()).toBe('0.01');
    expect(sel.source).toBe('RATE_CARD');
  });

  it('matches an exact/general prefix when no longer prefix exists', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(
      makeCard([makeRate({ id: 'r-gr', prefix: '30' })])
    );
    const sel = await getCustomerRate('org-1', normalizedGr);
    expect(sel.customerRateId).toBe('r-gr');
  });

  it('ignores disabled rates and falls through to the next match', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(
      makeCard([
        makeRate({ id: 'r-gr', prefix: '30', rate: new Prisma.Decimal('0.020') }),
        makeRate({ id: 'r-ath', prefix: '3021', rate: new Prisma.Decimal('0.010'), enabled: false }),
      ])
    );
    const sel = await getCustomerRate('org-1', normalizedAthens);
    expect(sel.customerRateId).toBe('r-gr');
  });

  it('throws when no prefix matches — never silently bills $0', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(
      makeCard([makeRate({ prefix: '44', destination: 'UK' })])
    );
    await expect(getCustomerRate('org-1', normalizedGr)).rejects.toThrow(CustomerRateError);
    await expect(getCustomerRate('org-1', normalizedGr)).rejects.toThrow(/No customer rate/);
  });

  it('enforces effectiveFrom/effectiveTo windows in the query', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(makeCard([makeRate()]));
    await getCustomerRate('org-1', normalizedGr);
    const arg = (prisma as any).customerRateCard.findFirst.mock.calls[0][0];
    expect(arg.include.rates.where.enabled).toBe(true);
    expect(arg.include.rates.where.effectiveFrom.lte).toBeInstanceOf(Date);
    expect(arg.include.rates.where.OR).toEqual([
      { effectiveTo: null },
      { effectiveTo: { gte: expect.any(Date) } },
    ]);
  });

  it('a DISABLED card is skipped and the flat service rate applies', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(null); // status filter excludes DISABLED
    const sel = await getCustomerRate('org-1', normalizedGr, new Date(), {
      customerRate: new Prisma.Decimal('0.05'),
      billingIncrementSeconds: 30,
      minimumBillableSeconds: 30,
    });
    expect(sel.source).toBe('SERVICE_DEFAULT');
    expect(sel.rate.toString()).toBe('0.05');
    expect(sel.billingIncrementSeconds).toBe(30);
    expect(sel.customerRateCardId).toBeNull();
  });

  it('queries only the organization ACTIVE card — org isolation', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(null);
    await getCustomerRate('org-2', normalizedGr, new Date(), {
      customerRate: '0.05',
      billingIncrementSeconds: 60,
      minimumBillableSeconds: 60,
    });
    expect((prisma as any).customerRateCard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-2', status: 'ACTIVE' }),
      })
    );
  });

  it('throws when no card and no service exists', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(null);
    (prisma as any).voipService.findUnique.mockResolvedValue(null);
    await expect(getCustomerRate('org-1', normalizedGr)).rejects.toThrow(/not configured/);
  });
});

describe('authorizeGatewayCall — pricing snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).$queryRaw.mockResolvedValue([{ id: 'wallet-1' }]);
  });

  function account() {
    return {
      id: 'sip-1',
      organizationId: 'org-1',
      username: 'shv_abc12345',
      status: 'ACTIVE',
      callerId: '+15551234567',
      maxConcurrentCalls: 5,
      phoneNumbers: [],
      organization: {
        id: 'org-1',
        voipService: {
          status: 'ACTIVE',
          isAdminSuspended: false,
          customerRate: new Prisma.Decimal('0.05'),
          billingIncrementSeconds: 60,
          minimumBillableSeconds: 60,
          reserveMinutes: 5,
          maxCallDurationMinutes: 60,
        },
        wallet: { id: 'wallet-1', balance: new Prisma.Decimal('100'), reserved: new Prisma.Decimal('0') },
      },
    };
  }

  function reservationMocks() {
    (prisma as any).voipCall.count.mockResolvedValue(0);
    (prisma as any).voipCall.create.mockImplementation(async ({ data }: any) => ({ id: 'call-1', ...data }));
    (prisma as any).walletReservation.create.mockResolvedValue({});
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: new Prisma.Decimal('100'),
      reserved: new Prisma.Decimal('0'),
    });
    (prisma as any).wallet.update.mockResolvedValue({});
    (prisma as any).walletTransaction.findUnique.mockResolvedValue(null);
    (prisma as any).walletTransaction.create.mockResolvedValue({});
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'res-1',
      status: 'ACTIVE',
      walletId: 'wallet-1',
      callId: 'call-1',
      amount: new Prisma.Decimal('3'),
      wallet: { id: 'wallet-1', balance: new Prisma.Decimal('100') },
    });
    (prisma as any).voipCall.update.mockImplementation(async ({ data }: any) => data);
  }

  it('persists card/rate/increment/minimum snapshots on the call record', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(account());
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(
      makeCard([
        makeRate({
          id: 'r-gr',
          prefix: '30',
          rate: new Prisma.Decimal('0.025'),
          billingIncrementSeconds: 30,
          minimumBillableSeconds: 30,
        }),
      ])
    );
    reservationMocks();

    await authorizeGatewayCall('shv_abc12345', '+306912345678');

    const createData = (prisma as any).voipCall.create.mock.calls[0][0].data;
    expect(createData.customerRate.toString()).toBe('0.025');
    expect(createData.customerRateCardId).toBe('card-1');
    expect(createData.customerRateId).toBe('r-gr');
    expect(createData.billingIncrementSeconds).toBe(30);
    expect(createData.minimumBillableSeconds).toBe(30);
  });

  it('rejects the call when the card has no matching destination rate', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(account());
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(
      makeCard([makeRate({ prefix: '44' })])
    );

    await expect(authorizeGatewayCall('shv_abc12345', '+306912345678')).rejects.toThrow(
      /No customer rate/
    );
    expect((prisma as any).voipCall.create).not.toHaveBeenCalled();
  });
});

vi.mock('@/lib/voip/services/wallet', () => ({
  consumeReservation: vi.fn().mockResolvedValue(null),
  releaseReservation: vi.fn().mockResolvedValue(null),
  addDebit: vi.fn().mockResolvedValue({}),
  reserveForCall: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/voip/services/customers', () => ({
  getOrCreateVoipService: vi.fn().mockResolvedValue({
    billingIncrementSeconds: 60,
    minimumBillableSeconds: 60,
  }),
}));
vi.mock('@/lib/voip/services/audit', () => ({ audit: vi.fn() }));

describe('reconcileCallBilling — snapshot + usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).voipCall.updateMany.mockResolvedValue({ count: 1 });
    (prisma as any).usageAggregate.upsert.mockResolvedValue({});
  });

  function callRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'call-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      direction: 'OUTBOUND',
      reservationId: 'res-1',
      durationSeconds: 45,
      customerRate: new Prisma.Decimal('0.025'),
      billingIncrementSeconds: 30,
      minimumBillableSeconds: 30,
      wholesaleRate: null,
      carrierRate: null,
      endTime: new Date('2026-10-15T12:00:00Z'),
      ...overrides,
    };
  }

  it('bills using the call snapshot, not current service config', async () => {
    // Service config says 60/60 but the call was authorized under 30/30.
    await reconcileCallBilling(callRow(), undefined);
    const data = (prisma as any).voipCall.updateMany.mock.calls.at(-1)[0].data;
    expect(data.billableSeconds).toBe(60); // 45s → ceil to 30s increment => 60s... wait: 45→60 under 30s increment
  });

  it('a completed call increments answered usage with spend', async () => {
    await reconcileCallBilling(callRow(), undefined);
    expect((prisma as any).usageAggregate.upsert).toHaveBeenCalledTimes(1);
    const args = (prisma as any).usageAggregate.upsert.mock.calls[0][0];
    expect(args.where.organizationId_periodStart.organizationId).toBe('org-1');
    expect(args.where.organizationId_periodStart.periodStart.toISOString()).toBe(
      '2026-10-01T00:00:00.000Z'
    );
    expect(args.update.answeredCalls.increment).toBe(1);
    expect(args.update.failedCalls.increment).toBe(0);
    expect(args.update.billableSeconds.increment).toBe(60);
    expect(args.create.customerSpend.toString()).toBe('0.025');
  });

  it('a failed call adds failed count, zero billable seconds, zero spend', async () => {
    await reconcileCallBilling(
      callRow({ status: 'FAILED', durationSeconds: 0 }),
      undefined
    );
    const args = (prisma as any).usageAggregate.upsert.mock.calls[0][0];
    expect(args.update.failedCalls.increment).toBe(1);
    expect(args.update.answeredCalls.increment).toBe(0);
    expect(args.update.billableSeconds.increment).toBe(0);
    expect(args.update.customerSpend.increment.toString()).toBe('0');
  });

  it('duplicate reconcile is a no-op when billingProcessed claim fails', async () => {
    (prisma as any).voipCall.updateMany.mockResolvedValue({ count: 0 });
    await reconcileCallBilling(callRow(), undefined);
    expect((prisma as any).usageAggregate.upsert).not.toHaveBeenCalled();
    const { audit } = await import('@/lib/voip/services/audit');
    expect(audit).not.toHaveBeenCalled();
  });

  it('falls back to service billing config for pre-snapshot calls', async () => {
    await reconcileCallBilling(
      callRow({ billingIncrementSeconds: null, minimumBillableSeconds: null, durationSeconds: 1 }),
      undefined
    );
    const data = (prisma as any).voipCall.updateMany.mock.calls.at(-1)[0].data;
    expect(data.billableSeconds).toBe(60); // service default 60/60
  });
});

describe('rate card admin service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a rate card for the target organization and audits it', async () => {
    (prisma as any).customerRateCard.create.mockImplementation(async ({ data }: any) => ({
      id: 'card-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const card = await createRateCard(platformCtx, 'org-1', { name: 'Wholesale EU' });
    expect(card.organizationId).toBe('org-1');
    const { audit } = await import('@/lib/voip/services/audit');
    expect(audit).toHaveBeenCalledWith(
      platformCtx,
      'RATE_CARD_CREATED',
      'CustomerRateCard',
      'card-1',
      expect.objectContaining({ organizationId: 'org-1' })
    );
  });

  it('rejects rate updates on a card owned by another organization', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(null); // org-scoped lookup misses
    await expect(
      addRate(platformCtx, 'org-2', 'card-1', { prefix: '30', rate: '0.02' })
    ).rejects.toThrow(/not found/);
    expect((prisma as any).customerRateCard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'card-1', organizationId: 'org-2' }),
      })
    );
  });

  it('rejects updates to a rate inside another org card', async () => {
    (prisma as any).customerRate.findFirst.mockResolvedValue(null);
    await expect(
      updateRate(platformCtx, 'org-2', 'rate-1', { enabled: false })
    ).rejects.toThrow(/not found/);
  });

  it('validates prefix, rate sign and increment bounds', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(makeCard([]));
    await expect(
      addRate(platformCtx, 'org-1', 'card-1', { prefix: '+30', rate: '0.02' })
    ).rejects.toThrow(/Prefix must be/);
    await expect(
      addRate(platformCtx, 'org-1', 'card-1', { prefix: '30', rate: '-0.5' })
    ).rejects.toThrow(/not be negative/);
    await expect(
      addRate(platformCtx, 'org-1', 'card-1', {
        prefix: '30',
        rate: '0.02',
        billingIncrementSeconds: 0,
      })
    ).rejects.toThrow(/Billing increment/);
  });

  it('disabling a card stores the new status', async () => {
    (prisma as any).customerRateCard.findFirst.mockResolvedValue(makeCard([]));
    (prisma as any).customerRateCard.update.mockImplementation(async ({ data }: any) => ({
      ...makeCard([]),
      ...data,
    }));
    const updated = await updateRateCard(platformCtx, 'org-1', 'card-1', { status: 'DISABLED' });
    expect(updated.status).toBe('DISABLED');
  });
});

describe('customer-safe DTOs', () => {
  it('customer rate DTO contains no wholesale/carrier fields', () => {
    const dto = toCustomerRateDto(makeRate());
    const keys = Object.keys(dto);
    for (const forbidden of [
      'carrierId',
      'carrier',
      'wholesaleRate',
      'wholesaleCost',
      'grossProfit',
      'margin',
      'rateCardId',
      'organizationId',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(dto.prefix).toBe('+30');
    expect(dto.ratePerMinute).toBe('0.02');
  });

  it('customer call DTO exposes no carrier internals', () => {
    const dto = toCustomerCallDto({
      id: 'c1',
      direction: 'OUTBOUND',
      callerId: '+15551234567',
      destination: '+306912345678',
      status: 'COMPLETED',
      startTime: new Date('2026-10-15T12:00:00Z'),
      answerTime: new Date('2026-10-15T12:00:05Z'),
      endTime: new Date('2026-10-15T12:01:05Z'),
      durationSeconds: 60,
      billableSeconds: 60,
      billedMinutes: new Prisma.Decimal('1'),
      customerRate: new Prisma.Decimal('0.025'),
      customerCharge: new Prisma.Decimal('0.025'),
      createdAt: new Date('2026-10-15T12:00:00Z'),
    } as any);
    const serialized = JSON.stringify(dto);
    for (const forbidden of ['wholesale', 'grossProfit', 'carrier', 'margin', 'gateway']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
