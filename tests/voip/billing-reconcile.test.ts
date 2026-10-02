import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { reconcileCallBilling } from '@/lib/voip/services/calls';
import { consumeReservation, releaseReservation, addDebit } from '@/lib/voip/services/wallet';
import { getOrCreateVoipService } from '@/lib/voip/services/customers';
import { audit } from '@/lib/voip/services/audit';

vi.mock('@/lib/db/prisma', () => {
  const p: any = {
    voipCall: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    usageAggregate: { upsert: vi.fn() },
    webhookEvent: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  p.$transaction = vi.fn((arg: any) =>
    typeof arg === 'function' ? arg(p) : Promise.all(arg)
  );
  return { prisma: p };
});

vi.mock('@/lib/voip/services/wallet', () => ({
  consumeReservation: vi.fn(),
  releaseReservation: vi.fn(),
  addDebit: vi.fn(),
}));

vi.mock('@/lib/voip/services/customers', () => ({
  getOrCreateVoipService: vi.fn(),
}));

vi.mock('@/lib/voip/services/audit', () => ({ audit: vi.fn() }));

const serviceConfig = {
  billingIncrementSeconds: 60,
  minimumBillableSeconds: 60,
};

function makeCall(overrides: Record<string, unknown> = {}) {
  return {
    id: 'call-1',
    status: 'COMPLETED',
    organizationId: 'org-1',
    direction: 'OUTBOUND',
    reservationId: 'res-1',
    durationSeconds: 120,
    customerRate: new Prisma.Decimal('0.016'),
    wholesaleRate: null,
    carrierRate: null,
    ...overrides,
  };
}

function lastUpdate() {
  return vi.mocked(prisma.voipCall.updateMany).mock.calls.at(-1)![0].data as Record<string, any>;
}

describe('reconcileCallBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateVoipService).mockResolvedValue(serviceConfig as any);
    vi.mocked(prisma.voipCall.update).mockResolvedValue({} as any);
    vi.mocked(prisma.voipCall.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked((prisma as any).usageAggregate.upsert).mockResolvedValue({} as any);
    vi.mocked(consumeReservation).mockResolvedValue(null as any);
    vi.mocked(releaseReservation).mockResolvedValue(null as any);
    vi.mocked(addDebit).mockResolvedValue({} as any);
  });

  it('bills an answered call with minimum and increment applied', async () => {
    await reconcileCallBilling(makeCall({ status: 'COMPLETED', durationSeconds: 45 }));
    const data = lastUpdate();
    expect(data.billableSeconds).toBe(60); // 45s rounded up to 60s minimum
    expect(data.customerCharge.toString()).toBe('0.016');
    expect(consumeReservation).toHaveBeenCalledWith('res-1', expect.anything());
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it('bills a 1-second answered call at the configured minimum', async () => {
    await reconcileCallBilling(makeCall({ status: 'COMPLETED', durationSeconds: 1 }));
    expect(lastUpdate().billableSeconds).toBe(60);
  });

  it('rounds answered call durations up to the billing increment', async () => {
    await reconcileCallBilling(makeCall({ status: 'COMPLETED', durationSeconds: 61 }));
    expect(lastUpdate().billableSeconds).toBe(120);
    expect(lastUpdate().customerCharge.toString()).toBe('0.032');
  });

  it('bills exact durations above the minimum unchanged', async () => {
    await reconcileCallBilling(makeCall({ status: 'COMPLETED', durationSeconds: 300 }));
    expect(lastUpdate().billableSeconds).toBe(300);
  });

  it.each(['FAILED', 'BUSY', 'NO_ANSWER', 'CANCELLED'])(
    'does not bill a %s call at zero duration',
    async (status) => {
      await reconcileCallBilling(makeCall({ status, durationSeconds: 0 }));
      const data = lastUpdate();
      expect(data.billableSeconds).toBe(0);
      expect(data.customerCharge.toString()).toBe('0');
      expect(releaseReservation).toHaveBeenCalledWith('res-1');
      expect(consumeReservation).not.toHaveBeenCalled();
      expect(addDebit).not.toHaveBeenCalled();
    }
  );

  it('does not apply the minimum to a failed call even if a duration was reported', async () => {
    await reconcileCallBilling(makeCall({ status: 'NO_ANSWER', durationSeconds: 30 }));
    const data = lastUpdate();
    expect(data.billableSeconds).toBe(0);
    expect(data.customerCharge.toString()).toBe('0');
  });

  it('still applies the minimum to an answered call with zero reported duration', async () => {
    await reconcileCallBilling(makeCall({ status: 'COMPLETED', durationSeconds: 0 }));
    expect(lastUpdate().billableSeconds).toBe(60);
  });

  it('does not debit the wallet for an outbound call without a reservation when charge is zero', async () => {
    await reconcileCallBilling(makeCall({ status: 'FAILED', durationSeconds: 0, reservationId: null }));
    expect(addDebit).not.toHaveBeenCalled();
  });

  it('debits an outbound call without a reservation when it was answered', async () => {
    await reconcileCallBilling(makeCall({ status: 'COMPLETED', durationSeconds: 120, reservationId: null }));
    expect(addDebit).toHaveBeenCalledWith(
      'org-1',
      expect.anything(),
      expect.stringContaining('call-1'),
      'call-1',
      'call:call-1:debit'
    );
  });

  it('does not touch the wallet for inbound calls', async () => {
    await reconcileCallBilling(makeCall({ direction: 'INBOUND', reservationId: null }));
    expect(consumeReservation).not.toHaveBeenCalled();
    expect(releaseReservation).not.toHaveBeenCalled();
    expect(addDebit).not.toHaveBeenCalled();
  });

  it('marks the call billing-processed and records an audit entry', async () => {
    await reconcileCallBilling(makeCall({ status: 'COMPLETED', durationSeconds: 120 }));
    expect(lastUpdate().billingProcessed).toBe(true);
    expect(audit).toHaveBeenCalledWith(
      null,
      'CALL_COMPLETED',
      'VoipCall',
      'call-1',
      expect.objectContaining({ billableSeconds: 120 })
    );
  });

  it('honors provider-reported wholesale cost even for a failed call', async () => {
    await reconcileCallBilling(
      makeCall({ status: 'FAILED', durationSeconds: 0 }),
      { wholesaleCost: new Prisma.Decimal('0.002') } as any
    );
    expect(lastUpdate().wholesaleCost?.toString()).toBe('0.002');
  });
});
