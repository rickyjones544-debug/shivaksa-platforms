import { Prisma } from '@prisma/client';
import { getSipPassword } from '@/lib/voip/services/sip';

export type CustomerServiceStatus = 'ACTIVE' | 'LOW_BALANCE' | 'ZERO_BALANCE' | 'SUSPENDED';

export function toCustomerSipAccountDto(account: {
  id: string;
  username: string;
  domain: string;
  status: string;
  callerId: string | null;
  phoneNumbers?: { number: string }[];
  passwordCipher: string;
  passwordTag: string;
  passwordIv: string;
}) {
  return {
    id: account.id,
    username: account.username,
    domain: account.domain,
    status: account.status,
    callerId: account.callerId,
    numbers: account.phoneNumbers?.map((n) => n.number) || [],
    password: getSipPassword({
      passwordCipher: account.passwordCipher,
      passwordTag: account.passwordTag,
      passwordIv: account.passwordIv,
    }),
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
}) {
  const effectiveStatus: CustomerServiceStatus = service.isAdminSuspended
    ? 'SUSPENDED'
    : (service.status as CustomerServiceStatus);

  return {
    status: effectiveStatus,
    customerRate: service.customerRate.toString(),
    reserveMinutes: service.reserveMinutes,
    maxCallDurationMinutes: service.maxCallDurationMinutes,
  };
}
