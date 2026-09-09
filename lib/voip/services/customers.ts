import { prisma } from '@/lib/db/prisma';
import { VoipServiceStatus, DEFAULT_CUSTOMER_RATE_CENTS_PER_MINUTE } from '@/lib/voip/constants';
import { toDecimal, getReserveAmount } from './billing';
import { getOrCreateWallet } from './wallet';
import { audit } from './audit';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { sendBalanceNotification } from './notifications';

export interface VoipServiceInput {
  customerRate?: string | number;
  billingIncrementSeconds?: number;
  minimumBillableSeconds?: number;
  reserveMinutes?: number;
  maxCallDurationMinutes?: number;
  lowBalanceThresholds?: number[];
}

export async function getOrCreateVoipService(organizationId: string) {
  const existing = await prisma.voipService.findUnique({ where: { organizationId } });
  if (existing) return existing;

  return prisma.voipService.create({
    data: {
      organizationId,
      status: VoipServiceStatus.ACTIVE,
      isAdminSuspended: false,
      customerRate: toDecimal(DEFAULT_CUSTOMER_RATE_CENTS_PER_MINUTE),
      billingIncrementSeconds: 60,
      minimumBillableSeconds: 60,
      reserveMinutes: 5,
      maxCallDurationMinutes: 60,
      lowBalanceThresholds: [20, 10, 5],
    },
  });
}

export async function getVoipService(organizationId: string) {
  return prisma.voipService.findUnique({ where: { organizationId } });
}

export async function updateVoipService(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  input: VoipServiceInput
) {
  const existing = await getOrCreateVoipService(organizationId);

  const data: Record<string, unknown> = {};
  if (input.customerRate !== undefined) {
    data.customerRate = toDecimal(input.customerRate);
  }
  if (input.billingIncrementSeconds !== undefined) data.billingIncrementSeconds = input.billingIncrementSeconds;
  if (input.minimumBillableSeconds !== undefined) data.minimumBillableSeconds = input.minimumBillableSeconds;
  if (input.reserveMinutes !== undefined) data.reserveMinutes = input.reserveMinutes;
  if (input.maxCallDurationMinutes !== undefined) data.maxCallDurationMinutes = input.maxCallDurationMinutes;
  if (input.lowBalanceThresholds !== undefined) data.lowBalanceThresholds = input.lowBalanceThresholds;

  const updated = await prisma.voipService.update({
    where: { id: existing.id },
    data,
  });

  await audit(ctx, 'RATE_CHANGED', 'VoipService', updated.id, {
    organizationId,
    changes: Object.keys(data),
  });

  return updated;
}

export async function setAdminSuspension(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  suspended: boolean
) {
  const service = await getOrCreateVoipService(organizationId);
  const updated = await prisma.voipService.update({
    where: { id: service.id },
    data: { isAdminSuspended: suspended },
  });

  await recomputeServiceStatus(organizationId);

  await audit(ctx, suspended ? 'CUSTOMER_SUSPENDED' : 'CUSTOMER_REACTIVATED', 'VoipService', updated.id, {
    organizationId,
    isAdminSuspended: suspended,
  });

  return updated;
}

export async function recomputeServiceStatus(organizationId: string) {
  const service = await prisma.voipService.findUnique({ where: { organizationId } });
  if (!service) return null;

  if (service.isAdminSuspended) {
    // Administrative suspension overrides automatic state changes.
    return service;
  }

  const wallet = await getOrCreateWallet(organizationId);
  const available = toDecimal(wallet.balance).minus(wallet.reserved);
  const reserve = getReserveAmount(service.customerRate, service.reserveMinutes);

  let newStatus: VoipServiceStatus = VoipServiceStatus.ACTIVE;
  if (available.lessThanOrEqualTo(0)) {
    newStatus = VoipServiceStatus.ZERO_BALANCE;
  } else if (available.lessThanOrEqualTo(reserve)) {
    newStatus = VoipServiceStatus.LOW_BALANCE;
  }

  if (service.status !== newStatus) {
    const updated = await prisma.voipService.update({
      where: { id: service.id },
      data: { status: newStatus },
    });

    if (newStatus === VoipServiceStatus.LOW_BALANCE) {
      await sendBalanceNotification(
        null,
        organizationId,
        'LOW_BALANCE',
        'Your VoIP balance is low. Your service has been temporarily restricted because your remaining balance is 5 minutes or less. Please add funds to continue calling.',
        service.reserveMinutes
      );
    } else if (newStatus === VoipServiceStatus.ZERO_BALANCE) {
      await sendBalanceNotification(
        null,
        organizationId,
        'ZERO_BALANCE',
        'Your VoIP balance is depleted. Please add funds to continue calling.',
        0
      );
    }

    await audit(null, 'SERVICE_STATUS_CHANGED', 'VoipService', updated.id, {
      organizationId,
      oldStatus: service.status,
      newStatus,
    });

    return updated;
  }

  return service;
}
