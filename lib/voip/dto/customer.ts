import { Prisma } from '@prisma/client';

export type CustomerServiceStatus = 'ACTIVE' | 'LOW_BALANCE' | 'ZERO_BALANCE' | 'SUSPENDED';

export const CUSTOMER_SIP_SERVER = process.env.SIP_SERVER_HOST || '82.152.141.69';
export const CUSTOMER_SIP_PORT = Number(process.env.SIP_SERVER_PORT || 5060);

export function toCustomerSipAccountDto(account: {
  id: string;
  username: string;
  domain: string;
  status: string;
  callerId: string | null;
  maxConcurrentCalls?: number;
  transport?: string;
  provisioningState?: string;
  registrationStatus?: string;
  lastRegisteredAt?: Date | null;
  registrationObservedAt?: Date | null;
  phoneNumbers?: { number: string }[];
}) {
  return {
    id: account.id,
    username: account.username,
    domain: account.domain,
    // Customer-facing connection details. Provider-independent: the customer
    // always points at the Shivaksa gateway, never at an upstream carrier.
    server: CUSTOMER_SIP_SERVER,
    port: CUSTOMER_SIP_PORT,
    transport: account.transport || 'UDP',
    status: account.status,
    callerId: account.callerId,
    maxConcurrentCalls: account.maxConcurrentCalls ?? 1,
    provisioningState: account.provisioningState || 'PENDING',
    registrationStatus: account.registrationStatus || 'UNKNOWN',
    lastRegisteredAt: account.lastRegisteredAt?.toISOString() || null,
    registrationObservedAt: account.registrationObservedAt?.toISOString() || null,
    numbers: account.phoneNumbers?.map((n) => n.number) || [],
  };
}

export function toCustomerPhoneNumberDto(phoneNumber: {
  id: string;
  number: string;
  displayNumber: string | null;
  status: string;
}) {
  return {
    id: phoneNumber.id,
    number: phoneNumber.number,
    displayNumber: phoneNumber.displayNumber || phoneNumber.number,
    status: phoneNumber.status,
  };
}

export function toCustomerCallDto(call: {
  id: string;
  direction: string;
  callerId: string;
  destination: string;
  status: string;
  startTime: Date | null;
  answerTime: Date | null;
  endTime: Date | null;
  durationSeconds: number | null;
  billableSeconds: number | null;
  billedMinutes: Prisma.Decimal | null;
  customerCharge: Prisma.Decimal | null;
  customerRate: Prisma.Decimal;
  createdAt: Date;
}) {
  return {
    id: call.id,
    direction: call.direction,
    callerId: call.callerId,
    destination: call.destination,
    status: call.status,
    startTime: call.startTime?.toISOString() || null,
    answerTime: call.answerTime?.toISOString() || null,
    endTime: call.endTime?.toISOString() || null,
    durationSeconds: call.durationSeconds,
    billableSeconds: call.billableSeconds,
    billedMinutes: call.billedMinutes?.toString() || null,
    customerCharge: call.customerCharge?.toString() || null,
    customerRate: call.customerRate.toString(),
    createdAt: call.createdAt.toISOString(),
  };
}

export function toCustomerWalletDto(wallet: {
  balance: Prisma.Decimal;
  reserved: Prisma.Decimal;
  currency: string;
}) {
  const available = wallet.balance.minus(wallet.reserved);
  return {
    balance: wallet.balance.toString(),
    reserved: wallet.reserved.toString(),
    available: available.toString(),
    currency: wallet.currency,
  };
}

export function toCustomerTransactionDto(tx: {
  id: string;
  type: string;
  amount: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  description: string | null;
  reference: string | null;
  createdAt: Date;
}) {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount.toString(),
    balanceAfter: tx.balanceAfter.toString(),
    description: tx.description,
    reference: tx.reference,
    createdAt: tx.createdAt.toISOString(),
  };
}

export function toCustomerServiceDto(service: {
  status: string;
  isAdminSuspended: boolean;
  customerRate: Prisma.Decimal;
  reserveMinutes: number;
  maxCallDurationMinutes: number;
  lowBalanceThresholds?: number[];
}) {
  const effectiveStatus: CustomerServiceStatus = service.isAdminSuspended
    ? 'SUSPENDED'
    : (service.status as CustomerServiceStatus);

  return {
    status: effectiveStatus,
    customerRate: service.customerRate.toString(),
    reserveMinutes: service.reserveMinutes,
    maxCallDurationMinutes: service.maxCallDurationMinutes,
    lowBalanceThresholds: service.lowBalanceThresholds || [],
  };
}

/**
 * Customer-facing selling rate. Deliberately excludes everything from the
 * carrier/wholesale layer — no carrier id, cost, margin or routing data.
 */
export function toCustomerRateDto(rate: {
  id: string;
  prefix: string;
  destination: string | null;
  country: string | null;
  rate: Prisma.Decimal;
  billingIncrementSeconds: number;
  minimumBillableSeconds: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  enabled: boolean;
}) {
  return {
    id: rate.id,
    prefix: `+${rate.prefix}`,
    destination: rate.destination,
    country: rate.country,
    ratePerMinute: rate.rate.toString(),
    billingIncrementSeconds: rate.billingIncrementSeconds,
    minimumBillableSeconds: rate.minimumBillableSeconds,
    effectiveFrom: rate.effectiveFrom.toISOString(),
    effectiveTo: rate.effectiveTo?.toISOString() || null,
    enabled: rate.enabled,
  };
}

export function toCustomerRateCardDto(card: {
  id: string;
  name: string;
  currency: string;
  status: string;
}) {
  return {
    id: card.id,
    name: card.name,
    currency: card.currency,
    status: card.status,
  };
}

export function toCustomerUsageDto(usage: {
  periodStart: Date;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  durationSeconds: number;
  billableSeconds: number;
  customerSpend: Prisma.Decimal;
}) {
  return {
    periodStart: usage.periodStart.toISOString(),
    totalCalls: usage.totalCalls,
    answeredCalls: usage.answeredCalls,
    failedCalls: usage.failedCalls,
    durationSeconds: usage.durationSeconds,
    billableSeconds: usage.billableSeconds,
    totalSpend: usage.customerSpend.toString(),
  };
}
