import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  reserveForCall,
  releaseReservation,
  sweepExpiredReservations,
} from '@/lib/voip/services/wallet';
import { toDecimal } from '@/lib/voip/services/billing';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const mockTx = {
  wallet: { update: vi.fn(), findUnique: vi.fn() },
  walletTransaction: { create: vi.fn(), findUnique: vi.fn() },
  walletReservation: { update: vi.fn(), create: vi.fn() },
};

const mockPrisma = {
  $transaction: vi.fn((cb: any) => cb(mockTx)),
  $queryRaw: vi.fn(),
  wallet: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  walletTransaction: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  walletReservation: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  voipService: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn() },
};

Object.assign(prisma as any, mockPrisma);

describe('wallet reservation lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).voipService.findUnique.mockResolvedValue(null);
  });

  it('sets an expiresAt on every new reservation', async () => {
    (prisma as any).$queryRaw.mockResolvedValue([{ id: 'w1' }]);
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    });
    (mockTx as any).walletReservation.create.mockResolvedValue({ id: 'res-1' });
    (mockTx as any).walletTransaction.create.mockResolvedValue({ id: 'tx-1' });

    await reserveForCall('w1', 'call-1', toDecimal(5), toDecimal(0.08));

    const createData = (mockTx as any).walletReservation.create.mock.calls[0][0].data;
    expect(createData.expiresAt).toBeInstanceOf(Date);
    expect(createData.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('sweeper releases an expired reservation for a finished call', async () => {
    (prisma as any).walletReservation.findMany.mockResolvedValue([
      {
        id: 'res-1',
        walletId: 'w1',
        callId: 'call-1',
        amount: toDecimal(5),
        status: 'ACTIVE',
        call: { id: 'call-1', status: 'FAILED' },
      },
    ]);
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'res-1',
      walletId: 'w1',
      callId: 'call-1',
      amount: toDecimal(5),
      status: 'ACTIVE',
      wallet: { id: 'w1', balance: toDecimal(10), reserved: toDecimal(5) },
    });
    (mockTx as any).wallet.update.mockResolvedValue({ id: 'w1', balance: toDecimal(10), reserved: toDecimal(0) });
    (mockTx as any).walletReservation.update.mockResolvedValue({ id: 'res-1', status: 'RELEASED' });
    (mockTx as any).walletTransaction.create.mockResolvedValue({ id: 'tx-release' });

    const result = await sweepExpiredReservations(new Date());
    expect(result.released).toBe(1);
    expect(result.extended).toBe(0);
    expect((mockTx as any).walletReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RELEASED' }) })
    );
  });

  it('sweeper extends a reservation whose call is still in progress', async () => {
    (prisma as any).walletReservation.findMany.mockResolvedValue([
      {
        id: 'res-live',
        walletId: 'w1',
        callId: 'call-live',
        amount: toDecimal(5),
        status: 'ACTIVE',
        call: { id: 'call-live', status: 'ANSWERED' },
      },
    ]);
    (prisma as any).walletReservation.update.mockResolvedValue({});

    const result = await sweepExpiredReservations(new Date());
    expect(result.released).toBe(0);
    expect(result.extended).toBe(1);
    const updateData = (prisma as any).walletReservation.update.mock.calls[0][0].data;
    expect(updateData.expiresAt).toBeInstanceOf(Date);
    expect((mockTx as any).wallet.update).not.toHaveBeenCalled();
  });

  it('sweeper releases a legacy reservation with no expiresAt and no call', async () => {
    (prisma as any).walletReservation.findMany.mockResolvedValue([
      {
        id: 'res-legacy',
        walletId: 'w1',
        callId: null,
        amount: toDecimal(2),
        status: 'ACTIVE',
        expiresAt: null,
        call: null,
      },
    ]);
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'res-legacy',
      walletId: 'w1',
      callId: null,
      amount: toDecimal(2),
      status: 'ACTIVE',
      wallet: { id: 'w1', balance: toDecimal(10), reserved: toDecimal(2) },
    });
    (mockTx as any).wallet.update.mockResolvedValue({ id: 'w1', balance: toDecimal(10), reserved: toDecimal(0) });
    (mockTx as any).walletReservation.update.mockResolvedValue({ id: 'res-legacy', status: 'RELEASED' });
    (mockTx as any).walletTransaction.create.mockResolvedValue({ id: 'tx-rel' });

    const result = await sweepExpiredReservations(new Date());
    expect(result.released).toBe(1);
  });

  it('sweeper never releases a reservation that was consumed between lookup and release', async () => {
    // Simulates the race: candidate was ACTIVE at scan time, CONSUMED by release time.
    (prisma as any).walletReservation.findMany.mockResolvedValue([
      {
        id: 'res-race',
        walletId: 'w1',
        callId: 'call-race',
        amount: toDecimal(5),
        status: 'ACTIVE',
        call: { id: 'call-race', status: 'COMPLETED' },
      },
    ]);
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'res-race',
      walletId: 'w1',
      callId: 'call-race',
      amount: toDecimal(5),
      status: 'CONSUMED',
      wallet: { id: 'w1', balance: toDecimal(5), reserved: toDecimal(0) },
    });

    const result = await sweepExpiredReservations(new Date());
    expect(result.released).toBe(0);
    expect((mockTx as any).wallet.update).not.toHaveBeenCalled();
  });

  it('releasing the same reservation twice is a no-op the second time', async () => {
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'res-1',
      walletId: 'w1',
      callId: 'call-1',
      amount: toDecimal(5),
      status: 'RELEASED',
      wallet: { id: 'w1', balance: toDecimal(10), reserved: toDecimal(0) },
    });

    const result = await releaseReservation('res-1');
    expect(result).toBeNull();
    expect((mockTx as any).wallet.update).not.toHaveBeenCalled();
  });
});
