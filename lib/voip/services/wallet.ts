import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { TransactionType, ReservationStatus } from '@/lib/voip/constants';
import { toDecimal, getReserveAmount } from './billing';
import { recomputeServiceStatus } from './customers';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { audit } from './audit';

export class InsufficientBalanceError extends Error {
  constructor(message = 'Insufficient balance') {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export async function getWallet(organizationId: string) {
  return prisma.wallet.findUnique({
    where: { organizationId },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
  });
}

export async function getOrCreateWallet(organizationId: string) {
  const existing = await prisma.wallet.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.wallet.create({
    data: {
      organizationId,
      balance: toDecimal(0),
      reserved: toDecimal(0),
    },
  });
}

export async function getTransactions(organizationId: string, take = 100, skip = 0) {
  return prisma.walletTransaction.findMany({
    where: { wallet: { organizationId } },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });
}

interface TransactionInputBase {
  walletId: string;
  organizationId: string;
  type: keyof typeof TransactionType;
  amount: Prisma.Decimal;
  description?: string;
  reference?: string;
  idempotencyKey?: string;
  createdById?: string;
  metadata?: Record<string, unknown>;
  balanceAfter?: Prisma.Decimal;
}

async function getWalletById(walletId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  return client.wallet.findUnique({
    where: { id: walletId },
    select: { id: true, balance: true, reserved: true },
  });
}

async function createTransactionRow(
  input: TransactionInputBase,
  tx: Prisma.TransactionClient
) {
  return tx.walletTransaction.create({
    data: {
      walletId: input.walletId,
      type: input.type,
      amount: input.amount,
      balanceAfter: input.balanceAfter ?? toDecimal(0),
      description: input.description,
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata as unknown as Prisma.InputJsonValue,
      createdById: input.createdById,
    },
  });
}

// Record a ledger entry WITHOUT changing the wallet balance.
// Used for reservations/releases and for final call debits when the balance
// has already been adjusted atomically.
export async function recordTransaction(input: TransactionInputBase) {
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { transaction: existing };
    }

    const transaction = await createTransactionRow(input, tx);
    return { transaction };
  });
}

// Update wallet balance AND record a ledger entry atomically.
async function addTransaction(input: TransactionInputBase) {
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        const wallet = await tx.wallet.findUnique({
          where: { id: input.walletId },
          select: { id: true, balance: true, reserved: true },
        });
        return { updated: wallet!, transaction: existing };
      }
    }

    const updated = await tx.wallet.update({
      where: { id: input.walletId },
      data: { balance: { increment: input.amount } },
      select: { id: true, balance: true, reserved: true },
    });

    const transaction = await createTransactionRow(
      { ...input, balanceAfter: toDecimal(updated.balance) },
      tx
    );

    return { updated, transaction };
  });
}

export async function addCredit(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  amount: Prisma.Decimal | string | number,
  description: string,
  createdById?: string,
  idempotencyKey?: string
) {
  const wallet = await getOrCreateWallet(organizationId);
  const credit = toDecimal(amount);
  if (credit.lessThanOrEqualTo(0)) throw new Error('Credit amount must be positive');

  const { transaction, updated } = await addTransaction({
    walletId: wallet.id,
    organizationId,
    type: 'CREDIT',
    amount: credit,
    description,
    createdById,
    idempotencyKey,
  });

  await recomputeServiceStatus(organizationId);

  await audit(ctx, 'CREDIT_ADDED', 'WalletTransaction', transaction.id, {
    organizationId,
    amount: credit.toString(),
    balanceAfter: updated.balance.toString(),
  });

  return { transaction, wallet: updated };
}

export async function addDebit(
  organizationId: string,
  amount: Prisma.Decimal | string | number,
  description: string,
  reference?: string,
  idempotencyKey?: string
) {
  const wallet = await getOrCreateWallet(organizationId);
  const debit = toDecimal(amount);
  if (debit.lessThanOrEqualTo(0)) throw new Error('Debit amount must be positive');

  const available = toDecimal(wallet.balance).minus(wallet.reserved);
  if (debit.greaterThan(available)) {
    throw new InsufficientBalanceError('Insufficient available balance for debit');
  }

  const { transaction, updated } = await addTransaction({
    walletId: wallet.id,
    organizationId,
    type: 'DEBIT',
    amount: debit.negated(),
    description,
    reference,
    idempotencyKey,
  });

  await recomputeServiceStatus(organizationId);

  return { transaction, wallet: updated };
}

export async function issueRefund(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  amount: Prisma.Decimal | string | number,
  description: string,
  createdById?: string,
  reference?: string,
  idempotencyKey?: string
) {
  const wallet = await getOrCreateWallet(organizationId);
  const refund = toDecimal(amount);
  if (refund.lessThanOrEqualTo(0)) throw new Error('Refund amount must be positive');

  const { transaction, updated } = await addTransaction({
    walletId: wallet.id,
    organizationId,
    type: 'REFUND',
    amount: refund,
    description,
    createdById,
    reference,
    idempotencyKey,
  });

  await recomputeServiceStatus(organizationId);

  await audit(ctx, 'REFUND_ISSUED', 'WalletTransaction', transaction.id, {
    organizationId,
    amount: refund.toString(),
  });

  return { transaction, wallet: updated };
}

export async function adjustBalance(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  amount: Prisma.Decimal | string | number,
  description: string,
  createdById?: string,
  idempotencyKey?: string
) {
  const wallet = await getOrCreateWallet(organizationId);
  const adjustment = toDecimal(amount);

  const { transaction, updated } = await addTransaction({
    walletId: wallet.id,
    organizationId,
    type: 'ADJUSTMENT',
    amount: adjustment,
    description,
    createdById,
    idempotencyKey,
  });

  await recomputeServiceStatus(organizationId);

  await audit(ctx, 'BALANCE_ADJUSTED', 'WalletTransaction', transaction.id, {
    organizationId,
    amount: adjustment.toString(),
  });

  return { transaction, wallet: updated };
}

export async function reserveForCall(
  walletId: string,
  callId: string,
  amount: Prisma.Decimal,
  minimumReserve: Prisma.Decimal
): Promise<void> {
  const reservationAmount = toDecimal(amount);
  const reserve = toDecimal(minimumReserve);

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "wallets"
    SET "reserved" = "reserved" + ${reservationAmount.toString()}::numeric
    WHERE "id" = ${walletId}
      AND ("balance" - "reserved" - ${reservationAmount.toString()}::numeric) >= ${reserve.toString()}::numeric
    RETURNING "id"
  `;

  if (!rows || rows.length === 0) {
    throw new InsufficientBalanceError(
      'Your available balance is too low to place a new call. Please add funds to continue calling.'
    );
  }

  const wallet = await getWalletById(walletId);

  await prisma.$transaction(async (tx) => {
    await tx.walletReservation.create({
      data: {
        walletId,
        callId,
        amount: reservationAmount,
        status: ReservationStatus.ACTIVE,
      },
    });

    await createTransactionRow(
      {
        walletId,
        organizationId: wallet?.id ?? '', // walletId is not organizationId; row uses wallet relation
        type: 'RESERVATION',
        amount: reservationAmount,
        description: 'Reserve funds for outbound call',
        reference: callId,
        idempotencyKey: `reserve:${callId}`,
        balanceAfter: toDecimal(wallet?.balance ?? 0),
      },
      tx
    );
  });
}

export async function releaseReservation(reservationId: string) {
  const reservation = await prisma.walletReservation.findUnique({
    where: { id: reservationId },
    include: { wallet: true },
  });

  if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: reservation.walletId },
      data: { reserved: { increment: reservation.amount.negated() } },
    });

    const updatedReservation = await tx.walletReservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.RELEASED,
        releasedAt: new Date(),
      },
    });

    await createTransactionRow(
      {
        walletId: reservation.walletId,
        organizationId: reservation.wallet.id,
        type: 'RELEASE',
        amount: reservation.amount.negated(),
        description: 'Release reserved funds for call',
        reference: reservation.callId ?? undefined,
        idempotencyKey: `release:${reservationId}`,
        balanceAfter: toDecimal(updatedWallet.balance),
      },
      tx
    );

    return { wallet: updatedWallet, reservation: updatedReservation };
  });
}

export async function consumeReservation(
  reservationId: string,
  actualCharge: Prisma.Decimal | string | number
) {
  const reservation = await prisma.walletReservation.findUnique({
    where: { id: reservationId },
    include: { wallet: true },
  });

  if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
    return null;
  }

  const charge = toDecimal(actualCharge);
  if (charge.greaterThan(reservation.amount)) {
    throw new Error('Actual charge exceeds reserved amount');
  }

  return prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: reservation.walletId },
      data: {
        balance: { increment: charge.negated() },
        reserved: { increment: reservation.amount.negated() },
      },
    });

    const updatedReservation = await tx.walletReservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CONSUMED,
        releasedAt: new Date(),
      },
    });

    await createTransactionRow(
      {
        walletId: reservation.walletId,
        organizationId: reservation.wallet.id,
        type: 'DEBIT',
        amount: charge.negated(),
        description: 'Charge for completed outbound call',
        reference: reservation.callId ?? undefined,
        idempotencyKey: `consume:${reservationId}`,
        balanceAfter: toDecimal(updatedWallet.balance),
      },
      tx
    );

    return { wallet: updatedWallet, reservation: updatedReservation };
  });
}

export async function getAvailableBalance(organizationId: string): Promise<Prisma.Decimal> {
  const wallet = await getOrCreateWallet(organizationId);
  return toDecimal(wallet.balance).minus(wallet.reserved);
}

export async function getReserveThreshold(organizationId: string): Promise<Prisma.Decimal> {
  const service = await prisma.voipService.findUnique({ where: { organizationId } });
  const rate = service ? toDecimal(service.customerRate) : toDecimal('0.016');
  const minutes = service?.reserveMinutes ?? 5;
  return getReserveAmount(rate, minutes);
}
