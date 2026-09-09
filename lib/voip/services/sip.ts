import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { SipAccountStatus } from '@/lib/voip/constants';
import { encryptValue, decryptValue, generateSecurePassword } from './crypto';
import { getProvider } from '@/lib/voip/providers';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { audit } from './audit';

export interface CreateSipAccountInput {
  username?: string;
  domain?: string;
  callerId?: string;
  maxConcurrentCalls?: number;
}

export interface UpdateSipAccountInput {
  status?: keyof typeof SipAccountStatus;
  callerId?: string;
  maxConcurrentCalls?: number;
  domain?: string;
}

export async function createSipAccount(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  input: CreateSipAccountInput
) {
  const username = input.username?.trim() || generateUsername();
  const password = generateSecurePassword(24);
  const encrypted = encryptValue(password);
  const domain = input.domain?.trim() || process.env.SIP_DOMAIN || 'sip.shivaksatechnology.com';

  const existing = await prisma.sipAccount.findUnique({
    where: { organizationId_username: { organizationId, username } },
  });

  if (existing) {
    throw new Error('SIP username already exists for this organization');
  }

  const account = await prisma.sipAccount.create({
    data: {
      organizationId,
      username,
      passwordCipher: encrypted.cipher,
      passwordTag: encrypted.tag,
      passwordIv: encrypted.iv,
      domain,
      status: SipAccountStatus.ACTIVE,
      maxConcurrentCalls: input.maxConcurrentCalls ?? 1,
      callerId: input.callerId?.trim() || null,
    },
  });

  // Optionally provision a Telnyx credential connection when credentials are configured.
  try {
    const provider = getProvider('telnyx');
    if (provider.createSipConnection) {
      const connection = await provider.createSipConnection({
        username: account.username,
        password,
        name: `Shivaksa ${organizationId.slice(0, 8)} ${account.username}`,
      });
      await prisma.sipAccount.update({
        where: { id: account.id },
        data: {
          providerConnectionId: connection.providerConnectionId,
          providerConfig: connection.rawResponse as unknown as Prisma.InputJsonValue,
        },
      });
    }
  } catch (error) {
    console.warn('[createSipAccount] Provider connection provisioning failed:', error);
  }

  await audit(ctx, 'SIP_ACCOUNT_CREATED', 'SipAccount', account.id, {
    organizationId,
    username: account.username,
  });

  return { ...account, password };
}

export async function getSipAccounts(organizationId: string) {
  return prisma.sipAccount.findMany({
    where: { organizationId },
    include: { phoneNumbers: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSipAccount(organizationId: string, id: string) {
  return prisma.sipAccount.findFirst({
    where: { id, organizationId },
    include: { phoneNumbers: true },
  });
}

export async function updateSipAccount(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  id: string,
  input: UpdateSipAccountInput
) {
  const account = await getSipAccount(organizationId, id);
  if (!account) throw new Error('SIP account not found');

  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if (input.callerId !== undefined) data.callerId = input.callerId?.trim() || null;
  if (input.maxConcurrentCalls !== undefined) data.maxConcurrentCalls = input.maxConcurrentCalls;
  if (input.domain) data.domain = input.domain.trim();

  const updated = await prisma.sipAccount.update({
    where: { id },
    data,
  });

  await audit(ctx, 'SIP_ACCOUNT_UPDATED', 'SipAccount', updated.id, {
    organizationId,
    changes: Object.keys(data),
  });

  return updated;
}

export async function resetSipPassword(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  id: string
) {
  const account = await getSipAccount(organizationId, id);
  if (!account) throw new Error('SIP account not found');

  const password = generateSecurePassword(24);
  const encrypted = encryptValue(password);

  const updated = await prisma.sipAccount.update({
    where: { id },
    data: {
      passwordCipher: encrypted.cipher,
      passwordTag: encrypted.tag,
      passwordIv: encrypted.iv,
    },
  });

  await audit(ctx, 'SIP_CREDENTIAL_RESET', 'SipAccount', updated.id, { organizationId });

  return { ...updated, password };
}

export function getSipPassword(account: {
  passwordCipher: string;
  passwordTag: string;
  passwordIv: string;
}): string {
  return decryptValue({
    cipher: account.passwordCipher,
    tag: account.passwordTag,
    iv: account.passwordIv,
  });
}

function generateUsername(): string {
  return `sip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
