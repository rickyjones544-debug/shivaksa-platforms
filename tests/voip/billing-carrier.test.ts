import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { reconcileCallBilling } from '@/lib/voip/services/calls';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const mockTx = {
  wallet: { update: vi.fn() },
  walletTransaction: { create: vi.fn() },
  walletReservation: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  voipCall: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  usageAggregate: { upsert: vi.fn().mockResolvedValue({}) },
};

function mockWalletAndReservation(amount: string) {
  const wallet = { id: 'w1', balance: new Prisma.Decimal('100'), reserved: new Prisma.Decimal('0') };
  const reservation = {
    id: 'res-1',
    status: 'ACTIVE',
    amount: new Prisma.Decimal(amount),
    walletId: 'w1',
    wallet,
    callId: 'call-1',
  };
  mockTx.wallet.update.mockResolvedValue(wallet);
  mockTx.walletTransaction.create.mockResolvedValue({ id: 'tx-1' });
  mockTx.walletReservation.findUnique.mockResolvedValue(reservation);
  mockTx.walletReservation.update.mockResolvedValue({ id: 'res-1', status: 'CONSUMED' });
  (prisma as any).walletReservation = {
    findUnique: vi.fn().mockResolvedValue(reservation),
  };
  (prisma as any).$transaction = vi.fn((cb: any) => cb(mockTx));
}

function mockService() {
  (prisma as any).voipService = {
    findUnique: vi.fn().mockResolvedValue({
      id: 'svc-1',
      customerRate: new Prisma.Decimal('0.05'),
      billingIncrementSeconds: 60,
      minimumBillableSeconds: 60,
      reserveMinutes: 5,
      maxCallDurationMinutes: 60,
      lowBalanceThresholds: [20, 10, 5],
    }),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

describe('Wholesale billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletAndReservation('10');
    mockService();
    (prisma as any).voipCall = { update: vi.fn().mockImplementation((args) => args.data) };
    (prisma as any).auditLog = { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
  });

  it('captures the selected wholesale rate on the call record', async () => {
    const call = {
      id: 'call-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      direction: 'OUTBOUND',
      reservationId: 'res-1',
      durationSeconds: 120,
      customerRate: new Prisma.Decimal('0.05'),
      wholesaleRate: new Prisma.Decimal('0.018'),
      carrierRate: {
        rate: new Prisma.Decimal('0.999'),
        billingIncrementSeconds: 1,
        minimumBillableSeconds: 1,
      },
    };

    await reconcileCallBilling(call as any, undefined);

    const updateData = mockTx.voipCall.updateMany.mock.calls[0][0].data;
    expect(updateData.wholesaleRate.toString()).toBe('0.018');
    // Customer charge: 2 minutes * 0.05 = 0.10
    expect(updateData.customerCharge.toString()).toBe('0.1');
    // Wholesale cost: 2 minutes * 0.018 = 0.036
    expect(updateData.wholesaleCost.toString()).toBe('0.036');
    // Gross profit: 0.10 - 0.036 = 0.064
    expect(updateData.grossProfit.toString()).toBe('0.064');
  });

  it('falls back to carrierRate when no wholesaleRate was captured', async () => {
    const call = {
      id: 'call-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      direction: 'OUTBOUND',
      reservationId: 'res-1',
      durationSeconds: 60,
      customerRate: new Prisma.Decimal('0.05'),
      wholesaleRate: null,
      carrierRate: {
        rate: new Prisma.Decimal('0.018'),
        billingIncrementSeconds: 1,
        minimumBillableSeconds: 1,
      },
    };

    await reconcileCallBilling(call as any, undefined);

    const updateData = mockTx.voipCall.updateMany.mock.calls[0][0].data;
    expect(updateData.wholesaleCost.toString()).toBe('0.018');
  });

  it('does not retroactively change billing when the carrier rate is updated later', async () => {
    // Call captured rate A at call-creation time.
    const call = {
      id: 'call-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      direction: 'OUTBOUND',
      reservationId: 'res-1',
      durationSeconds: 60,
      customerRate: new Prisma.Decimal('0.05'),
      wholesaleRate: new Prisma.Decimal('0.018'),
      carrierRate: {
        // Simulates the carrier_rate row being updated to a newer rate.
        rate: new Prisma.Decimal('0.025'),
        billingIncrementSeconds: 1,
        minimumBillableSeconds: 1,
      },
    };

    await reconcileCallBilling(call as any, undefined);

    const updateData = mockTx.voipCall.updateMany.mock.calls[0][0].data;
    // Stored wholesaleRate wins; updated row rate is ignored.
    expect(updateData.wholesaleCost.toString()).toBe('0.018');
  });

  it('applies carrier billing increment and minimum billable seconds', async () => {
    const call = {
      id: 'call-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      direction: 'OUTBOUND',
      reservationId: 'res-1',
      durationSeconds: 45,
      customerRate: new Prisma.Decimal('0.05'),
      wholesaleRate: new Prisma.Decimal('0.018'),
      carrierRate: {
        rate: new Prisma.Decimal('0.018'),
        billingIncrementSeconds: 60,
        minimumBillableSeconds: 60,
      },
    };

    await reconcileCallBilling(call as any, undefined);

    const updateData = mockTx.voipCall.updateMany.mock.calls[0][0].data;
    // 45s with 60/60 increment/minimum => 60s => 1 minute * 0.018
    expect(updateData.wholesaleCost.toString()).toBe('0.018');
  });

  it('prefers provider-reported wholesale cost over the rate table', async () => {
    const call = {
      id: 'call-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      direction: 'OUTBOUND',
      reservationId: 'res-1',
      durationSeconds: 60,
      customerRate: new Prisma.Decimal('0.05'),
      wholesaleRate: new Prisma.Decimal('0.018'),
      carrierRate: null,
    };

    await reconcileCallBilling(call as any, { wholesaleCost: new Prisma.Decimal('0.015') } as any);

    const updateData = mockTx.voipCall.updateMany.mock.calls[0][0].data;
    expect(updateData.wholesaleCost.toString()).toBe('0.015');
  });
});
