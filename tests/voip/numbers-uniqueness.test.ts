import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { createPhoneNumber, updatePhoneNumber } from '@/lib/voip/services/numbers';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    phoneNumber: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sipAccount: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  } as any,
}));

const ctx = {
  user: { id: 'u1', name: 'User', email: 'u@a.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
  role: { id: 'r1', name: 'CLIENT_ADMIN' },
  permissions: ['voip:manage'],
} as any;

describe('PhoneNumber global active-number uniqueness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects creating a number already ACTIVE on another organization', async () => {
    (prisma as any).phoneNumber.findFirst.mockResolvedValue({ id: 'existing-1' });

    await expect(
      createPhoneNumber(ctx, 'org-1', { number: '+15551234567' })
    ).rejects.toThrow('already active');
    expect((prisma as any).phoneNumber.create).not.toHaveBeenCalled();
  });

  it('creates the number when no ACTIVE record exists', async () => {
    (prisma as any).phoneNumber.findFirst.mockResolvedValue(null);
    (prisma as any).phoneNumber.create.mockResolvedValue({ id: 'pn-1' });

    const result = await createPhoneNumber(ctx, 'org-1', { number: '+15551234567' });
    expect(result.id).toBe('pn-1');
    expect((prisma as any).phoneNumber.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ number: '+15551234567', status: 'ACTIVE' }),
      })
    );
  });

  it('blocks reactivating a number that another account holds ACTIVE', async () => {
    (prisma as any).phoneNumber.findFirst
      .mockResolvedValueOnce({ id: 'pn-1', organizationId: 'org-1', number: '+15550000000', status: 'INACTIVE' })
      .mockResolvedValueOnce({ id: 'conflict-9' });

    await expect(
      updatePhoneNumber(ctx, 'org-1', 'pn-1', { status: 'ACTIVE' })
    ).rejects.toThrow('already active');
    expect((prisma as any).phoneNumber.update).not.toHaveBeenCalled();
  });

  it('allows reactivation when no other ACTIVE record exists', async () => {
    (prisma as any).phoneNumber.findFirst
      .mockResolvedValueOnce({ id: 'pn-1', organizationId: 'org-1', number: '+15550000000', status: 'INACTIVE' })
      .mockResolvedValueOnce(null);
    (prisma as any).phoneNumber.update.mockResolvedValue({ id: 'pn-1', status: 'ACTIVE' });

    const result = await updatePhoneNumber(ctx, 'org-1', 'pn-1', { status: 'ACTIVE' });
    expect(result.status).toBe('ACTIVE');
  });
});
