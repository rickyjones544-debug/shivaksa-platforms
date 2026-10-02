import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { SipAccountStatus } from '@/lib/voip/constants';
import { encryptValue, decryptValue, generateSecurePassword } from './crypto';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { audit } from './audit';
import { assertVoipEligibility } from './eligibility';
import { toCustomerSipAccountDto } from '@/lib/voip/dto/customer';
import {
  computeSipAuthMd5,
  queueEndpointUpsert,
  queueEndpointDisable,
} from './provisioning';

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
  await assertVoipEligibility(organizationId);
  const password = generateSecurePassword(24);
  const encrypted = encryptValue(password);
  const domain = input.domain?.trim() || process.env.SIP_DOMAIN || 'sip.shivaksatechnology.com';

  // SIP usernames are globally unique: Asterisk identifies endpoints by
  // username, so an org-local collision would break provisioning.
  const username = input.username?.trim()
    ? await assertUsernameAvailable(input.username.trim())
    : await generateUniqueUsername();

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
      provisioningState: 'PENDING',
      asteriskEndpoint: username,
    },
  });

  // Queue the endpoint for the Asterisk gateway agent. The plaintext is only
  // used to derive the md5 digest — it is never sent to or stored on the VPS.
  await queueEndpointUpsert(account.id, {
    username: account.username,
    md5Cred: computeSipAuthMd5(account.username, password),
    maxConcurrentCalls: account.maxConcurrentCalls,
  });

  await audit(ctx, 'SIP_ACCOUNT_CREATED', 'SipAccount', account.id, {
    organizationId,
    username: account.username,
  });

  // The plaintext password is returned exactly once, here. It is never stored
  // unencrypted and never appears in list/read DTOs.
  return { ...toCustomerSipAccountDto(account), password };
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

  const statusChanged = input.status !== undefined && input.status !== account.status;

  const updated = await prisma.sipAccount.update({
    where: { id },
    data,
  });

  // Keep Asterisk in sync with enable/disable. Disable is a remove-if-present
  // operation; enable re-upserts the endpoint with its current credential.
  if (statusChanged) {
    if (updated.status === SipAccountStatus.DISABLED) {
      await queueEndpointDisable(updated.id, updated.username);
    } else if (updated.status === SipAccountStatus.ACTIVE) {
      await queueEndpointUpsert(updated.id, {
        username: updated.username,
        md5Cred: computeSipAuthMd5(updated.username, getSipPassword(updated)),
        maxConcurrentCalls: updated.maxConcurrentCalls,
      });
    }
  }

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

  // Rotate the credential on the gateway. If the account is disabled the new
  // digest is simply stored for the next enable.
  if (updated.status === SipAccountStatus.ACTIVE) {
    await queueEndpointUpsert(updated.id, {
      username: updated.username,
      md5Cred: computeSipAuthMd5(updated.username, password),
      maxConcurrentCalls: updated.maxConcurrentCalls,
    });
  }

  await audit(ctx, 'SIP_CREDENTIAL_RESET', 'SipAccount', updated.id, { organizationId });

  // Return the newly generated password once. The previous credential is
  // invalidated by this operation and is never returned.
  return {
    ...toCustomerSipAccountDto(updated),
    password,
    notice: 'This is the new SIP password. The previous password has been invalidated and is shown only once.',
  };
}

/**
 * Reveal the current SIP password for an account the caller owns.
 * Deliberate, audited read of a decrypted secret — never used by list/read
 * DTOs and never logged.
 */
export async function revealSipPassword(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  id: string
) {
  const account = await getSipAccount(organizationId, id);
  if (!account) throw new Error('SIP account not found');

  await audit(ctx, 'SIP_CREDENTIAL_REVEALED', 'SipAccount', account.id, { organizationId });

  return { password: getSipPassword(account) };
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

const USERNAME_PATTERN = /^shv_[a-z0-9]{8,32}$/;

async function assertUsernameAvailable(username: string): Promise<string> {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      'Invalid SIP username format. Use the shv_ prefix followed by 8–32 lowercase letters or digits (e.g. shv_client01).'
    );
  }
  const existing = await prisma.sipAccount.findUnique({ where: { username } });
  if (existing) {
    throw new Error('SIP username already exists');
  }
  return username;
}

/**
 * Globally unique, provider-independent username. The namespace is a single
 * flat `shv_` prefix so customers never see organization IDs and Asterisk
 * endpoint names stay predictable (`asteriskEndpoint === username`).
 */
async function generateUniqueUsername(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `shv_${randomBytes(6).toString('hex')}`;
    const existing = await prisma.sipAccount.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error('Unable to generate a unique SIP username');
}
