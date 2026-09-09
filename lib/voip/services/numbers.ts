import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PhoneNumberStatus } from '@/lib/voip/constants';
import { getProvider } from '@/lib/voip/providers';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { audit } from './audit';

export interface CreatePhoneNumberInput {
  number: string;
  displayNumber?: string;
  providerNumberId?: string;
  sipAccountId?: string;
  provider?: string;
}

export interface UpdatePhoneNumberInput {
  displayNumber?: string;
  status?: keyof typeof PhoneNumberStatus;
  sipAccountId?: string | null;
}

export async function createPhoneNumber(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  input: CreatePhoneNumberInput
) {
  const normalized = input.number.trim();
  const provider = input.provider || 'telnyx';

  const account = input.sipAccountId
    ? await prisma.sipAccount.findFirst({
        where: { id: input.sipAccountId, organizationId },
      })
    : null;

  const data: Prisma.PhoneNumberUncheckedCreateInput = {
    organizationId,
    number: normalized,
    displayNumber: input.displayNumber?.trim() || normalized,
    status: PhoneNumberStatus.ACTIVE,
    provider,
    providerNumberId: input.providerNumberId?.trim() || null,
    sipAccountId: account?.id || null,
  };

  const phoneNumber = await prisma.phoneNumber.create({ data });

  // If the SIP account has a provider connection, assign the number to it.
  if (account?.providerConnectionId && phoneNumber.providerNumberId) {
    try {
      const providerAdapter = getProvider(provider);
      if (providerAdapter.assignNumberToConnection) {
        await providerAdapter.assignNumberToConnection({
          providerNumberId: phoneNumber.providerNumberId,
          providerConnectionId: account.providerConnectionId,
        });
        await prisma.phoneNumber.update({
          where: { id: phoneNumber.id },
          data: { providerConnectionId: account.providerConnectionId },
        });
      }
    } catch (error) {
      console.warn('[createPhoneNumber] Provider number assignment failed:', error);
    }
  }

  await audit(ctx, 'PHONE_NUMBER_CREATED', 'PhoneNumber', phoneNumber.id, {
    organizationId,
    number: normalized,
  });

  return phoneNumber;
}

export async function getPhoneNumbers(organizationId: string) {
  return prisma.phoneNumber.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPhoneNumber(organizationId: string, id: string) {
  return prisma.phoneNumber.findFirst({
    where: { id, organizationId },
  });
}

export async function updatePhoneNumber(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  id: string,
  input: UpdatePhoneNumberInput
) {
  const phoneNumber = await getPhoneNumber(organizationId, id);
  if (!phoneNumber) throw new Error('Phone number not found');

  const data: Prisma.PhoneNumberUncheckedUpdateInput = {};
  if (input.displayNumber !== undefined) data.displayNumber = input.displayNumber?.trim() || phoneNumber.number;
  if (input.status) data.status = input.status;
  if (input.sipAccountId !== undefined) data.sipAccountId = input.sipAccountId || null;

  const updated = await prisma.phoneNumber.update({
    where: { id },
    data,
  });

  await audit(ctx, 'PHONE_NUMBER_UPDATED', 'PhoneNumber', updated.id, {
    organizationId,
    changes: Object.keys(data),
  });

  return updated;
}

export async function assignPhoneNumberToSipAccount(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  phoneNumberId: string,
  sipAccountId: string
) {
  const phoneNumber = await getPhoneNumber(organizationId, phoneNumberId);
  if (!phoneNumber) throw new Error('Phone number not found');

  const account = await prisma.sipAccount.findFirst({
    where: { id: sipAccountId, organizationId },
  });
  if (!account) throw new Error('SIP account not found');

  const updated = await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: { sipAccountId: account.id },
  });

  if (account.providerConnectionId && phoneNumber.providerNumberId) {
    try {
      const providerAdapter = getProvider(phoneNumber.provider);
      if (providerAdapter.assignNumberToConnection) {
        await providerAdapter.assignNumberToConnection({
          providerNumberId: phoneNumber.providerNumberId,
          providerConnectionId: account.providerConnectionId,
        });
        await prisma.phoneNumber.update({
          where: { id: updated.id },
          data: { providerConnectionId: account.providerConnectionId },
        });
      }
    } catch (error) {
      console.warn('[assignPhoneNumberToSipAccount] Provider assignment failed:', error);
    }
  }

  await audit(ctx, 'PHONE_NUMBER_ASSIGNED', 'PhoneNumber', updated.id, {
    organizationId,
    sipAccountId: account.id,
  });

  return updated;
}
