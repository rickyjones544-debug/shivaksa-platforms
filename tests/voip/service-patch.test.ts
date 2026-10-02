import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { PATCH } from '@/app/api/voip/service/route';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/auth';

vi.mock('@/lib/auth/auth', () => ({ getCurrentUser: vi.fn() }));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    voipService: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn() },
    wallet: { findUnique: vi.fn() },
  } as any,
}));

const authedCtx = {
  user: { id: 'u1', name: 'User', email: 'u@a.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
  role: { id: 'r1', name: 'CLIENT_ADMIN' },
  permissions: ['voip:manage'],
};

const serviceRow = {
  id: 'svc-1',
  organizationId: 'org-1',
  status: 'ACTIVE',
  isAdminSuspended: false,
  customerRate: new Prisma.Decimal('0.016'),
  billingIncrementSeconds: 60,
  minimumBillableSeconds: 60,
  reserveMinutes: 5,
  maxCallDurationMinutes: 60,
  lowBalanceThresholds: [20, 10, 5],
};

function patchRequest(body: unknown) {
  return new NextRequest(new URL('https://app.shivaksatechnology.com/api/voip/service'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/voip/service field allow-list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(authedCtx as any);
    (prisma as any).voipService.findUnique.mockResolvedValue(serviceRow);
    (prisma as any).voipService.update.mockImplementation(async ({ data }: any) => ({ ...serviceRow, ...data }));
  });

  it.each(['customerRate', 'billingIncrementSeconds', 'minimumBillableSeconds', 'reserveMinutes', 'maxCallDurationMinutes'])(
    'rejects a customer attempt to modify %s',
    async (field) => {
      const res = await PATCH(patchRequest({ [field]: field === 'customerRate' ? '0.99' : 1 }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain(field);
      expect((prisma as any).voipService.update).not.toHaveBeenCalled();
    }
  );

  it('rejects a multi-field payload containing a protected field', async () => {
    const res = await PATCH(patchRequest({ customerRate: '0.99', lowBalanceThresholds: [10] }));
    expect(res.status).toBe(403);
    expect((prisma as any).voipService.update).not.toHaveBeenCalled();
  });

  it('rejects unknown fields outright', async () => {
    const res = await PATCH(patchRequest({ margin: '999', route: 'cheap' }));
    expect(res.status).toBe(403);
    expect((prisma as any).voipService.update).not.toHaveBeenCalled();
  });

  it('allows a customer to update only lowBalanceThresholds', async () => {
    const res = await PATCH(patchRequest({ lowBalanceThresholds: [30, 5] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const updateData = (prisma as any).voipService.update.mock.calls[0][0].data;
    expect(updateData).toEqual({ lowBalanceThresholds: [30, 5] });
  });

  it('rejects malformed lowBalanceThresholds values', async () => {
    const res = await PATCH(patchRequest({ lowBalanceThresholds: ['lots', -1] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect((prisma as any).voipService.update).not.toHaveBeenCalled();
  });
});
