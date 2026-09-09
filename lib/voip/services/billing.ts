import { Prisma } from '@prisma/client';
import {
  DEFAULT_BILLING_INCREMENT_SECONDS,
  DEFAULT_CUSTOMER_RATE_CENTS_PER_MINUTE,
  DEFAULT_MAX_CALL_DURATION_MINUTES,
  DEFAULT_MINIMUM_BILLABLE_SECONDS,
  DEFAULT_RESERVE_MINUTES,
} from '@/lib/voip/constants';

export const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

export function toDecimal(value: string | number | Prisma.Decimal | { toString(): string }): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === 'number') return new Prisma.Decimal(value.toString());
  if (value && typeof value === 'object' && 'toString' in value) return new Prisma.Decimal(value.toString());
  return new Prisma.Decimal(value as string);
}

export function calculateBillableSeconds(
  durationSeconds: number,
  billingIncrementSeconds = DEFAULT_BILLING_INCREMENT_SECONDS,
  minimumBillableSeconds = DEFAULT_MINIMUM_BILLABLE_SECONDS
): number {
  const effective = Math.max(minimumBillableSeconds, durationSeconds || 0);
  if (!billingIncrementSeconds || billingIncrementSeconds <= 1) {
    return effective;
  }
  return Math.ceil(effective / billingIncrementSeconds) * billingIncrementSeconds;
}

export function secondsToBillableMinutes(seconds: number): Prisma.Decimal {
  return toDecimal(seconds).dividedBy(60).toDecimalPlaces(4, ROUND_HALF_UP);
}

export function calculateCustomerCharge(
  billableSeconds: number,
  ratePerMinute: Prisma.Decimal | string | number
): Prisma.Decimal {
  const minutes = secondsToBillableMinutes(billableSeconds);
  return minutes.times(toDecimal(ratePerMinute)).toDecimalPlaces(4, ROUND_HALF_UP);
}

export function calculateWholesaleCost(
  billableSeconds: number,
  wholesaleRatePerMinute?: Prisma.Decimal | string | number | null
): Prisma.Decimal | null {
  if (wholesaleRatePerMinute === undefined || wholesaleRatePerMinute === null) return null;
  const minutes = secondsToBillableMinutes(billableSeconds);
  return minutes.times(toDecimal(wholesaleRatePerMinute)).toDecimalPlaces(4, ROUND_HALF_UP);
}

export function calculateGrossProfit(
  customerCharge: Prisma.Decimal,
  wholesaleCost: Prisma.Decimal | null
): Prisma.Decimal | null {
  if (wholesaleCost === null) return null;
  return customerCharge.minus(wholesaleCost).toDecimalPlaces(4, ROUND_HALF_UP);
}

export function getReserveAmount(
  ratePerMinute: Prisma.Decimal | string | number,
  reserveMinutes = DEFAULT_RESERVE_MINUTES
): Prisma.Decimal {
  return toDecimal(ratePerMinute).times(reserveMinutes).toDecimalPlaces(4, ROUND_HALF_UP);
}

export function getMaxCallCost(
  ratePerMinute: Prisma.Decimal | string | number,
  maxCallDurationMinutes = DEFAULT_MAX_CALL_DURATION_MINUTES
): Prisma.Decimal {
  return toDecimal(ratePerMinute).times(maxCallDurationMinutes).toDecimalPlaces(4, ROUND_HALF_UP);
}

export function getEstimatedMinutes(balance: Prisma.Decimal | string | number, ratePerMinute: Prisma.Decimal | string | number): Prisma.Decimal {
  const rate = toDecimal(ratePerMinute);
  if (rate.isZero()) return toDecimal(0);
  return toDecimal(balance).dividedBy(rate).toDecimalPlaces(2, ROUND_HALF_UP);
}

export function buildDefaultVoipServiceConfig() {
  return {
    status: 'ACTIVE',
    isAdminSuspended: false,
    customerRate: toDecimal(DEFAULT_CUSTOMER_RATE_CENTS_PER_MINUTE),
    billingIncrementSeconds: DEFAULT_BILLING_INCREMENT_SECONDS,
    minimumBillableSeconds: DEFAULT_MINIMUM_BILLABLE_SECONDS,
    reserveMinutes: DEFAULT_RESERVE_MINUTES,
    lowBalanceThresholds: [20, 10, 5],
    maxCallDurationMinutes: DEFAULT_MAX_CALL_DURATION_MINUTES,
  };
}
