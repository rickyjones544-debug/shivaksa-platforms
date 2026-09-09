import { Prisma } from '@prisma/client';
import type { CustomerServiceStatus } from './customer';

export function toAdminSipAccountDto(account: {
  id: string;
  username: string;
  domain: string;
  status: string;
  callerId: string | null;
  maxConcurrentCalls: number;
  providerConnectionId: string | null;
  providerConfig: unknown | null;
  phoneNumbers?: { number: string }[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: account.id,
    username: account.username,
    domain: account.domain,
    status: account.status,
    callerId: account.callerId,
    maxConcurrentCalls: account.maxConcurrentCalls,
    providerConnectionId: account.providerConnectionId,
    providerConfig: account.providerConfig,
    numbers: account.phoneNumbers?.map((n) => n.number) || [],
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function toAdminPhoneNumberDto(phoneNumber: {
  id: string;
  number: string;
  displayNumber: string | null;
  status: string;
  provider: string;
  providerNumberId: string | null;
  providerConnectionId: string | null;
  sipAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: phoneNumber.id,
    number: phoneNumber.number,
    displayNumber: phoneNumber.displayNumber || phoneNumber.number,
    status: phoneNumber.status,
    provider: phoneNumber.provider,
    providerNumberId: phoneNumber.providerNumberId,
    providerConnectionId: phoneNumber.providerConnectionId,
    sipAccountId: phoneNumber.sipAccountId,
    createdAt: phoneNumber.createdAt.toISOString(),
    updatedAt: phoneNumber.updatedAt.toISOString(),
  };
}

export function toAdminCallDto(call: {
  id: string;
  organizationId: string;
  sipAccountId: string | null;
  phoneNumberId: string | null;
  direction: string;
  callerId: string;
  destination: string;
  status: string;
  provider: string;
  providerCallId: string | null;
  startTime: Date | null;
  answerTime: Date | null;
  endTime: Date | null;
  durationSeconds: number | null;
  billableSeconds: number | null;
  billedMinutes: Prisma.Decimal | null;
  customerRate: Prisma.Decimal;
  customerCharge: Prisma.Decimal | null;
  wholesaleCost: Prisma.Decimal | null;
  grossProfit: Prisma.Decimal | null;
  failureReason: string | null;
  routingInfo: unknown | null;
  reservationId: string | null;
  billingProcessed: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: call.id,
    organizationId: call.organizationId,
    sipAccountId: call.sipAccountId,
    phoneNumberId: call.phoneNumberId,
    direction: call.direction,
    callerId: call.callerId,
    destination: call.destination,
    status: call.status,
    provider: call.provider,
    providerCallId: call.providerCallId,
    startTime: call.startTime?.toISOString() || null,
    answerTime: call.answerTime?.toISOString() || null,
    endTime: call.endTime?.toISOString() || null,
    durationSeconds: call.durationSeconds,
    billableSeconds: call.billableSeconds,
    billedMinutes: call.billedMinutes?.toString() || null,
    customerRate: call.customerRate.toString(),
    customerCharge: call.customerCharge?.toString() || null,
    wholesaleCost: call.wholesaleCost?.toString() || null,
    grossProfit: call.grossProfit?.toString() || null,
    failureReason: call.failureReason,
    routingInfo: call.routingInfo,
    reservationId: call.reservationId,
    billingProcessed: call.billingProcessed,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
  };
}

export function toAdminServiceDto(service: {
  id: string;
  organizationId: string;
  status: string;
  isAdminSuspended: boolean;
  customerRate: Prisma.Decimal;
  billingIncrementSeconds: number;
  minimumBillableSeconds: number;
  reserveMinutes: number;
  maxCallDurationMinutes: number;
  lowBalanceThresholds: number[];
  createdAt: Date;
  updatedAt: Date;
}) {
  const effectiveStatus: CustomerServiceStatus = service.isAdminSuspended
    ? 'SUSPENDED'
    : (service.status as CustomerServiceStatus);

  return {
    id: service.id,
    organizationId: service.organizationId,
    status: effectiveStatus,
    isAdminSuspended: service.isAdminSuspended,
    customerRate: service.customerRate.toString(),
    billingIncrementSeconds: service.billingIncrementSeconds,
    minimumBillableSeconds: service.minimumBillableSeconds,
    reserveMinutes: service.reserveMinutes,
    maxCallDurationMinutes: service.maxCallDurationMinutes,
    lowBalanceThresholds: service.lowBalanceThresholds,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}
