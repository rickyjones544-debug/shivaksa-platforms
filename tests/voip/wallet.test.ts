import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  addCredit,
  addDebit,
  consumeReservation,
  releaseReservation,
  issueRefund,
  InsufficientBalanceError,
  getAvailableBalance,
  getWallet,
  reserveForCall,
  getOrCreateWallet,
} from '@/lib/voip/services/wallet';
import { recomputeServiceStatus } from '@/lib/voip/services/customers';
import { processVerifiedTopUp } from '@/lib/payments/topup';
import {
  calculateCustomerCharge,
  calculateBillableSeconds,
  toDecimal,
} from '@/lib/voip/services/billing';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const mockTx = {
  wallet: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  walletTransaction: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  walletReservation: {
    update: vi.fn(),
    create: vi.fn(),
  },
};

const mockPrisma = {
  $transaction: vi.fn((cb: any) => cb(mockTx)),
  $queryRaw: vi.fn(),
  wallet: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  walletTransaction: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  walletReservation: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  voipService: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  notification: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

Object.assign(prisma as any, mockPrisma);

describe('Wallet and billing foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).voipService.findUnique.mockResolvedValue(null);
  });

  it('charges the customer rate correctly for a 2-minute call', () => {
    const charge = calculateCustomerCharge(120, '0.016');
    expect(charge.toString()).toBe('0.032');
  });

  it('rounds billable seconds up to the billing increment', () => {
    const seconds = calculateBillableSeconds(45, 60, 60);
    expect(seconds).toBe(60);
  });

  it('applies minimum billable seconds', () => {
    const seconds = calculateBillableSeconds(0, 60, 60);
    expect(seconds).toBe(60);
  });

  it('rejects a non-positive credit amount', async () => {
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(0),
      reserved: toDecimal(0),
    });

    await expect(addCredit(null, 'org-1', 0, 'test')).rejects.toThrow(
      'Credit amount must be positive'
    );
  });

  it('credits a wallet with an idempotency key and audit event', async () => {
    const wallet = {
      id: 'w1',
      balance: toDecimal(0),
      reserved: toDecimal(0),
    };
    (prisma as any).wallet.findUnique.mockResolvedValue(wallet);
    (mockTx as any).walletTransaction.findUnique.mockResolvedValue(null);
    (mockTx as any).wallet.update.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    });
    (mockTx as any).walletTransaction.create.mockResolvedValue({
      id: 'tx-credit',
      type: 'CREDIT',
      amount: toDecimal(10),
      balanceAfter: toDecimal(10),
    });

    const result = await addCredit(null, 'org-1', 10, 'Test credit', 'admin-1', 'key-1');
    expect(result.transaction.type).toBe('CREDIT');
    expect((prisma as any).auditLog.create).toHaveBeenCalled();
    const auditData = (prisma as any).auditLog.create.mock.calls[0][0].data;
    expect(auditData.action).toBe('CREDIT_ADDED');
  });

  it('returns an existing credit transaction when the idempotency key is reused', async () => {
    const wallet = {
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    };
    (prisma as any).wallet.findUnique.mockResolvedValue(wallet);
    const existingTx = { id: 'tx-1', amount: toDecimal(5), balanceAfter: toDecimal(15) };
    (mockTx as any).walletTransaction.findUnique.mockResolvedValue(existingTx);
    (mockTx as any).wallet.findUnique.mockResolvedValue(wallet);

    const result = await addCredit(null, 'org-1', 5, 'Top-up', 'u1', 'key-1');
    expect(result.transaction.id).toBe('tx-1');
    expect((mockTx as any).wallet.update).not.toHaveBeenCalled();
  });

  it('rejects a debit amount greater than the available balance', async () => {
    const wallet = {
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    };
    (prisma as any).wallet.findUnique.mockResolvedValue(wallet);

    await expect(addDebit('org-1', 20, 'test')).rejects.toBeInstanceOf(
      InsufficientBalanceError
    );
  });

  it('rejects a non-positive debit amount', async () => {
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    });

    await expect(addDebit('org-1', -5, 'test')).rejects.toThrow(
      'Debit amount must be positive'
    );
  });

  it('consumes a reservation, debits the actual charge, and records a debit transaction', async () => {
    const wallet = {
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(5),
    };
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'ACTIVE',
      amount: toDecimal(5),
      walletId: 'w1',
      wallet,
      callId: 'call-1',
    });

    (mockTx as any).wallet.update.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(7),
      reserved: toDecimal(0),
    });
    (mockTx as any).walletReservation.update.mockResolvedValue({
      id: 'r1',
      status: 'CONSUMED',
    });
    (mockTx as any).walletTransaction.create.mockResolvedValue({ id: 'tx-debit' });

    const result = await consumeReservation('r1', '0.032');
    expect(result).not.toBeNull();
    expect((mockTx as any).wallet.update).toHaveBeenCalled();
    expect((mockTx as any).walletTransaction.create).toHaveBeenCalled();
    const txData = (mockTx as any).walletTransaction.create.mock.calls[0][0].data;
    expect(txData.type).toBe('DEBIT');
    expect(txData.amount.toString()).toBe('-0.032');
    expect(txData.idempotencyKey).toBe('consume:r1');
  });

  it('does not double-charge a call when the reservation is already consumed', async () => {
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'CONSUMED',
      amount: toDecimal(5),
      walletId: 'w1',
      wallet: { id: 'w1', balance: toDecimal(10), reserved: toDecimal(0) },
      callId: 'call-1',
    });

    const result = await consumeReservation('r1', '0.032');
    expect(result).toBeNull();
  });

  it('releases a reservation and records a release transaction for a failed call', async () => {
    const wallet = {
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(5),
    };
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'ACTIVE',
      amount: toDecimal(5),
      walletId: 'w1',
      wallet,
      callId: 'call-1',
    });

    (mockTx as any).wallet.update.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    });
    (mockTx as any).walletReservation.update.mockResolvedValue({
      id: 'r1',
      status: 'RELEASED',
    });
    (mockTx as any).walletTransaction.create.mockResolvedValue({ id: 'tx-release' });

    const result = await releaseReservation('r1');
    expect(result).not.toBeNull();
    expect((mockTx as any).walletReservation.update).toHaveBeenCalled();
    const txData = (mockTx as any).walletTransaction.create.mock.calls[0][0].data;
    expect(txData.type).toBe('RELEASE');
    expect(txData.idempotencyKey).toBe('release:r1');
  });

  it('does not release a reservation that is already released', async () => {
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'RELEASED',
      amount: toDecimal(5),
      walletId: 'w1',
      wallet: { id: 'w1', balance: toDecimal(10), reserved: toDecimal(0) },
      callId: 'call-1',
    });

    const result = await releaseReservation('r1');
    expect(result).toBeNull();
  });

  it('prevents a second reservation when available balance is insufficient', async () => {
    (prisma as any).$queryRaw
      .mockResolvedValueOnce([{ id: 'w1' }])
      .mockResolvedValueOnce([]);
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    });
    (mockTx as any).walletReservation.create.mockResolvedValue({ id: 'res-1' });
    (mockTx as any).walletTransaction.create.mockResolvedValue({ id: 'tx-1' });

    await reserveForCall('w1', 'call-1', toDecimal(5), toDecimal(0.08));
    await expect(
      reserveForCall('w1', 'call-2', toDecimal(20), toDecimal(0.08))
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('allows a customer to view only their own wallet', async () => {
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'w1',
      organizationId: 'org-1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    });

    const wallet = await getWallet('org-1');
    expect(wallet).not.toBeNull();
    expect((prisma as any).wallet.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    );
  });

  it('queries transaction history scoped to the organization', async () => {
    (prisma as any).walletTransaction.findMany.mockResolvedValue([]);
    const { getTransactions } = await import('@/lib/voip/services/wallet');
    await getTransactions('org-2', 10, 0);
    expect((prisma as any).walletTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { wallet: { organizationId: 'org-2' } },
      })
    );
  });

  it('rejects a top-up that does not include a verified payment reference', async () => {
    await expect(
      processVerifiedTopUp(null, 'org-1', 10, '')
    ).rejects.toThrow('A verified payment reference is required');
  });

  it('credits the wallet through a verified top-up with idempotency', async () => {
    const wallet = {
      id: 'w1',
      balance: toDecimal(0),
      reserved: toDecimal(0),
    };
    (prisma as any).wallet.findUnique.mockResolvedValue(wallet);
    (mockTx as any).walletTransaction.findUnique.mockResolvedValue(null);
    (mockTx as any).wallet.update.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    });
    (mockTx as any).walletTransaction.create.mockResolvedValue({
      id: 'tx-topup',
      type: 'CREDIT',
      amount: toDecimal(10),
      balanceAfter: toDecimal(10),
      idempotencyKey: 'topup:pi_123',
    });
    (prisma as any).voipService.findUnique.mockResolvedValue(null);

    const result = await processVerifiedTopUp(null, 'org-1', 10, 'pi_123');
    expect(result.transaction.type).toBe('CREDIT');
    expect(result.transaction.idempotencyKey).toBe('topup:pi_123');
  });

  it('recomputes the service status to LOW_BALANCE when available funds are too low', async () => {
    (prisma as any).voipService.findUnique.mockResolvedValue({
      id: 'svc-1',
      organizationId: 'org-low',
      status: 'ACTIVE',
      isAdminSuspended: false,
      customerRate: toDecimal('0.016'),
      reserveMinutes: 5,
    });
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'w1',
      organizationId: 'org-low',
      balance: toDecimal(0.05),
      reserved: toDecimal(0),
    });
    (prisma as any).voipService.update.mockResolvedValue({
      id: 'svc-1',
      status: 'LOW_BALANCE',
    });
    (prisma as any).notification.findFirst.mockResolvedValue(null);
    (prisma as any).notification.create.mockResolvedValue({ id: 'n1' });

    const result = await recomputeServiceStatus('org-low');
    expect(result).not.toBeNull();
    expect((prisma as any).voipService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'svc-1' },
        data: { status: 'LOW_BALANCE' },
      })
    );
  });

  it('does not process a refund twice with the same idempotency key', async () => {
    const wallet = {
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(0),
    };
    (prisma as any).wallet.findUnique.mockResolvedValue(wallet);
    const existingTx = { id: 'tx-refund', amount: toDecimal(2), balanceAfter: toDecimal(12) };
    (mockTx as any).walletTransaction.findUnique.mockResolvedValue(existingTx);
    (mockTx as any).wallet.findUnique.mockResolvedValue(wallet);

    const result = await issueRefund(null, 'org-1', 2, 'Refund', 'admin-1', 'ref-1', 'key-ref');
    expect(result.transaction.id).toBe('tx-refund');
    expect((mockTx as any).wallet.update).not.toHaveBeenCalled();
  });

  it('returns the available balance after reserved funds are considered', async () => {
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'w1',
      balance: toDecimal(10),
      reserved: toDecimal(3),
    });

    const available = await getAvailableBalance('org-1');
    expect(available.toString()).toBe('7');
  });
});
