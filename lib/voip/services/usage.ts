import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CallStatus } from '@/lib/voip/constants';

/**
 * Usage aggregation (Phase 3).
 *
 * `usage_aggregates` is a monthly rollup derived ONLY from server-side,
 * reconciled VoipCall rows. Customers never write here. Aggregation happens
 * inside the billing-reconciliation transaction, gated on the call's
 * billingProcessed claim, so duplicate gateway events/webhooks cannot
 * double-count.
 *
 * `periodStart` is the first day of the calendar month (UTC) — a usage
 * period, NOT an invoice or billing period.
 */

const ACTIVE_STATUSES: readonly string[] = [
  CallStatus.INITIATED,
  CallStatus.RINGING,
  CallStatus.ANSWERED,
];

export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function periodStartFor(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export interface UsageDelta {
  answered: boolean;
  durationSeconds: number;
  billableSeconds: number;
  customerCharge: Prisma.Decimal;
}

/**
 * Increment the monthly aggregate for one reconciled call. Must be called
 * with the transaction-scoped client AFTER the billingProcessed claim has
 * succeeded — that claim is what makes this idempotent.
 */
export async function applyUsageDelta(
  tx: Prisma.TransactionClient,
  organizationId: string,
  periodStart: Date,
  delta: UsageDelta
): Promise<void> {
  await tx.usageAggregate.upsert({
    where: {
      organizationId_periodStart: { organizationId, periodStart },
    },
    create: {
      organizationId,
      periodStart,
      totalCalls: 1,
      answeredCalls: delta.answered ? 1 : 0,
      failedCalls: delta.answered ? 0 : 1,
      durationSeconds: delta.durationSeconds,
      billableSeconds: delta.billableSeconds,
      customerSpend: delta.customerCharge,
    },
    update: {
      totalCalls: { increment: 1 },
      answeredCalls: { increment: delta.answered ? 1 : 0 },
      failedCalls: { increment: delta.answered ? 0 : 1 },
      durationSeconds: { increment: delta.durationSeconds },
      billableSeconds: { increment: delta.billableSeconds },
      customerSpend: { increment: delta.customerCharge },
    },
  });
}

/** Authoritative count of in-progress calls for an organization. */
export async function getActiveCallCount(organizationId: string): Promise<number> {
  return prisma.voipCall.count({
    where: { organizationId, status: { in: [...ACTIVE_STATUSES] } },
  });
}

export async function getUsageForPeriod(organizationId: string, periodStart: Date) {
  return prisma.usageAggregate.findUnique({
    where: { organizationId_periodStart: { organizationId, periodStart } },
  });
}

export async function getUsageHistory(organizationId: string, periods = 6) {
  return prisma.usageAggregate.findMany({
    where: { organizationId },
    orderBy: { periodStart: 'desc' },
    take: periods,
  });
}
