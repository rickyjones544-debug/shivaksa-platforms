import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  createCarrier,
  updateCarrier,
  listCarriers,
  createCarrierRate,
  createCarrierCredential,
  CarrierAuthorizationError,
} from '@/lib/voip/services/carriers';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const superAdminCtx: AuthenticatedContext = {
  user: {
    id: 'u1',
    name: 'Admin',
    email: 'admin@example.com',
    isSuperAdmin: true,
  },
  membership: null,
  organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
  role: null,
  permissions: [],
};

const operationsCtx: AuthenticatedContext = {
  user: { id: 'u2', name: 'Ops', email: 'ops@example.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
  role: { id: 'r1', name: 'OPERATIONS_MANAGER' },
  permissions: ['carrier:manage'],
};

function mockAudit() {
  (prisma as any).auditLog = { create: vi.fn() };
}

describe('Carrier administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudit();
  });

  it('creates a platform-wide carrier as super admin', async () => {
    const carrier = {
      id: 'c1',
      code: 'teloz',
      name: 'Teloz',
      type: 'SIP_GATEWAY',
      enabled: true,
      status: 'TEST',
      organizationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma as any).carrier = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(carrier),
    };

    const result = await createCarrier(superAdminCtx, {
      name: 'Teloz',
      code: 'teloz',
      type: 'SIP_GATEWAY',
      authenticationType: 'IP_AUTH',
    });

    expect(result.carrier.code).toBe('teloz');
    expect((prisma as any).carrier.create).toHaveBeenCalled();
    expect((prisma as any).auditLog.create).toHaveBeenCalled();
  });

  it('rejects duplicate carrier codes', async () => {
    (prisma as any).carrier = {
      findUnique: vi.fn().mockResolvedValue({ id: 'existing', code: 'teloz' }),
      create: vi.fn(),
    };

    await expect(
      createCarrier(superAdminCtx, {
        name: 'Teloz',
        code: 'teloz',
        type: 'SIP_GATEWAY',
        authenticationType: 'IP_AUTH',
      })
    ).rejects.toThrow(CarrierAuthorizationError);
  });

  it('lists carriers scoped to the active organization', async () => {
    (prisma as any).carrier = {
      findMany: vi.fn().mockResolvedValue([]),
    };

    await listCarriers(operationsCtx);

    const where = (prisma as any).carrier.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { organizationId: null },
      { organizationId: 'org-1' },
    ]);
  });

  it('updates carrier metadata', async () => {
    const existing = {
      id: 'c1',
      code: 'teloz',
      name: 'Teloz',
      organizationId: null,
      enabled: true,
      status: 'TEST',
    };
    const updated = { ...existing, name: 'Teloz Wholesale' };

    (prisma as any).carrier = {
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updated),
    };

    const result = await updateCarrier(superAdminCtx, 'c1', { name: 'Teloz Wholesale' });
    expect(result.name).toBe('Teloz Wholesale');
  });

  it('creates a rate for a carrier', async () => {
    const carrier = {
      id: 'c1',
      code: 'teloz',
      organizationId: null,
      billingIncrementSeconds: 1,
      minimumBillableSeconds: 1,
    };

    (prisma as any).carrier = {
      findUnique: vi.fn().mockResolvedValue(carrier),
    };
    (prisma as any).carrierRate = {
      create: vi.fn().mockImplementation((args) => ({ id: 'r1', ...args.data })),
    };

    const rate = await createCarrierRate(superAdminCtx, 'c1', {
      prefix: '30',
      country: 'GR',
      destinationType: 'ALL',
      rate: '0.018',
    });

    expect(rate.prefix).toBe('30');
    expect(rate.rate.toString()).toBe('0.018');
  });

  it('creates encrypted credentials for a carrier', async () => {
    const carrier = { id: 'c1', code: 'teloz', organizationId: null };

    (prisma as any).carrier = {
      findUnique: vi.fn().mockResolvedValue(carrier),
    };
    (prisma as any).carrierCredential = {
      upsert: vi.fn().mockImplementation((args) => ({ id: 'cred-1', ...args.update })),
    };

    process.env.ENCRYPTION_KEY = 'test-key-32-characters-long-here';

    const credential = await createCarrierCredential(superAdminCtx, 'c1', {
      username: 'user',
      password: 'secret',
      realm: 'sip.example.com',
    });

    expect(credential.passwordCipher).toBeDefined();
    expect(credential.passwordTag).toBeDefined();
    expect(credential.passwordIv).toBeDefined();

    delete process.env.ENCRYPTION_KEY;
  });
});
