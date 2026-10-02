import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { resetSipPassword, revealSipPassword } from '@/lib/voip/services/sip';
import { encryptValue, decryptValue } from '@/lib/voip/services/crypto';
import { toCustomerSipAccountDto } from '@/lib/voip/dto/customer';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    sipAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    provisioningTask: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as any,
}));

const ctx = {
  user: { id: 'u1', name: 'User', email: 'u@a.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
  role: { id: 'r1', name: 'CLIENT_ADMIN' },
  permissions: ['voip:manage'],
} as unknown as AuthenticatedContext;

function accountWithPassword(plaintext: string) {
  const enc = encryptValue(plaintext);
  return {
    id: 'sip-1',
    organizationId: 'org-1',
    username: 'customer001',
    domain: 'sip.shivaksatechnology.com',
    status: 'ACTIVE',
    callerId: null,
    phoneNumbers: [],
    passwordCipher: enc.cipher,
    passwordTag: enc.tag,
    passwordIv: enc.iv,
  };
}

describe('SIP credential handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reset generates a new encrypted password and returns it exactly once', async () => {
    const account = accountWithPassword('old-secret');
    (prisma as any).sipAccount.findFirst.mockResolvedValue(account);
    (prisma as any).sipAccount.update.mockImplementation(async ({ data }: any) => ({
      ...account,
      ...data,
    }));

    const result = await resetSipPassword(ctx, 'org-1', 'sip-1');

    expect(typeof result.password).toBe('string');
    expect(result.password.length).toBeGreaterThanOrEqual(24);
    expect(result.notice).toMatch(/invalidated/i);
    expect(result.password).not.toBe('old-secret');

    // Stored value is encrypted — the plaintext never lands in the database row.
    const updateData = (prisma as any).sipAccount.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('password');
    expect(updateData.passwordCipher).not.toBe(result.password);
    expect(
      decryptValue({
        cipher: updateData.passwordCipher,
        tag: updateData.passwordTag,
        iv: updateData.passwordIv,
      })
    ).toBe(result.password);
  });

  it('reset writes a SIP_CREDENTIAL_RESET audit entry', async () => {
    const account = accountWithPassword('old-secret');
    (prisma as any).sipAccount.findFirst.mockResolvedValue(account);
    (prisma as any).sipAccount.update.mockImplementation(async ({ data }: any) => ({ ...account, ...data }));

    await resetSipPassword(ctx, 'org-1', 'sip-1');
    const auditData = (prisma as any).auditLog.create.mock.calls[0][0].data;
    expect(auditData.action).toBe('SIP_CREDENTIAL_RESET');
  });

  it('reveal returns the current password and audits the access', async () => {
    const account = accountWithPassword('current-secret');
    (prisma as any).sipAccount.findFirst.mockResolvedValue(account);

    const result = await revealSipPassword(ctx, 'org-1', 'sip-1');
    expect(result.password).toBe('current-secret');

    const auditData = (prisma as any).auditLog.create.mock.calls[0][0].data;
    expect(auditData.action).toBe('SIP_CREDENTIAL_REVEALED');
  });

  it('reveal scopes the lookup to the caller organization', async () => {
    (prisma as any).sipAccount.findFirst.mockResolvedValue(null);
    await expect(revealSipPassword(ctx, 'org-2', 'sip-1')).rejects.toThrow('SIP account not found');
    expect((prisma as any).sipAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-2' }) })
    );
  });

  it('normal account DTOs never contain the password', () => {
    const account = accountWithPassword('super-secret');
    const dto = toCustomerSipAccountDto(account);
    expect(dto).not.toHaveProperty('password');
    expect(JSON.stringify(dto)).not.toContain('super-secret');
  });
});
