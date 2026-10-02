import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key';

vi.mock('@/lib/db/prisma', () => {
  const p: any = {
    sipAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    provisioningTask: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    voipCall: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    customerRateCard: { findFirst: vi.fn() },
    usageAggregate: { upsert: vi.fn() },
    wallet: { findUnique: vi.fn(), update: vi.fn() },
    walletTransaction: { create: vi.fn(), findUnique: vi.fn() },
    walletReservation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    carrierRoutePolicy: { findMany: vi.fn() },
    carrierRate: { findMany: vi.fn() },
    carrierCliProfile: { findFirst: vi.fn() },
    carrierCliEntry: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  p.$executeRaw = vi.fn().mockResolvedValue(1);
  // Supports both array form ($transaction([...])) and callback form
  // ($transaction(async tx => ...)) with the same mocked client.
  p.$transaction = vi.fn((arg: any) =>
    typeof arg === 'function' ? arg(p) : Promise.all(arg)
  );
  p.$queryRaw = vi.fn().mockResolvedValue([{ id: 'wallet-1' }]);
  return { prisma: p };
});

vi.mock('@/lib/voip/services/eligibility', () => ({
  assertVoipEligibility: vi.fn().mockResolvedValue(undefined),
}));

import {
  createSipAccount,
  updateSipAccount,
  resetSipPassword,
} from '@/lib/voip/services/sip';
import { encryptValue } from '@/lib/voip/services/crypto';
import {
  computeSipAuthMd5,
  applyProvisioningResult,
  ProvisioningTaskStatuses,
} from '@/lib/voip/services/provisioning';
import { authorizeAndRouteGatewayCall } from '@/lib/voip/services/gateway';
import { Prisma } from '@prisma/client';
import { DestinationType, CarrierStatus, CliMode } from '@/lib/voip/constants';
import { POST as handleRegistration } from '@/app/api/internal/gateway/registration/route';
import { GET as handlePending } from '@/app/api/internal/gateway/provisioning/pending/route';
import { POST as handleResult } from '@/app/api/internal/gateway/provisioning/result/route';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

const ctx = {
  user: { id: 'u1', name: 'User', email: 'u@a.com', isSuperAdmin: true },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
  role: { id: 'r1', name: 'SUPER_ADMIN' },
  permissions: ['admin:manage'],
} as unknown as AuthenticatedContext;

function makeAccount(overrides: Record<string, unknown> = {}) {
  const enc = encryptValue('current-sip-password');
  return {
    id: 'sip-1',
    organizationId: 'org-1',
    username: 'shv_abc12345',
    domain: 'sip.shivaksatechnology.com',
    status: 'ACTIVE',
    callerId: '+15551234567',
    maxConcurrentCalls: 2,
    phoneNumbers: [],
    passwordCipher: enc.cipher,
    passwordTag: enc.tag,
    passwordIv: enc.iv,
    provisioningState: 'PROVISIONED',
    asteriskEndpoint: 'shv_abc12345',
    registrationStatus: 'UNKNOWN',
    ...overrides,
  };
}

function gwRequest(url: string, body?: unknown, apiKey = 'gateway-secret') {
  return new NextRequest(`http://localhost${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: apiKey ? { 'x-gateway-api-key': apiKey } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Global SIP username uniqueness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GATEWAY_API_KEY', 'gateway-secret');
  });

  it('generates globally unique shv_ usernames', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(null);
    (prisma as any).sipAccount.create.mockImplementation(async ({ data }: any) => data);

    const a = await createSipAccount(ctx, 'org-1', {});
    const b = await createSipAccount(ctx, 'org-1', {});

    expect(a.username).toMatch(/^shv_[a-z0-9]{12}$/);
    expect(b.username).toMatch(/^shv_[a-z0-9]{12}$/);
    expect(a.username).not.toBe(b.username);
  });

  it('rejects a username already taken globally (any org)', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue({ id: 'other', username: 'shv_taken0001' });
    await expect(createSipAccount(ctx, 'org-1', { username: 'shv_taken0001' })).rejects.toThrow(
      /already exists/
    );
  });

  it('rejects usernames that do not match the platform format', async () => {
    await expect(createSipAccount(ctx, 'org-1', { username: 'CUSTOMER USER' })).rejects.toThrow(
      /Invalid SIP username format/
    );
  });
});

describe('Provisioning task queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GATEWAY_API_KEY', 'gateway-secret');
  });

  it('create queues an UPSERT_ENDPOINT task with an md5 digest, never plaintext', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(null);
    (prisma as any).sipAccount.create.mockImplementation(async ({ data }: any) => data);
    (prisma as any).sipAccount.update.mockImplementation(async ({ data }: any) => ({ ...data, id: 'sip-1' }));
    (prisma as any).provisioningTask.create.mockResolvedValue({ id: 't-1' });

    const result = await createSipAccount(ctx, 'org-1', {});

    const task = (prisma as any).provisioningTask.create.mock.calls[0][0].data;
    expect(task.action).toBe('UPSERT_ENDPOINT');
    expect(task.payload.md5Cred).toMatch(/^[0-9a-f]{32}$/);
    // The plaintext password must never transit or rest in the task payload.
    expect(JSON.stringify(task.payload)).not.toContain(result.password);
    // Account starts in PENDING until the agent reports success.
    const accountUpdate = (prisma as any).sipAccount.update.mock.calls[0][0].data;
    expect(accountUpdate.provisioningState).toBe('PENDING');
  });

  it('md5 digest matches Asterisk auth_type=md5 semantics (md5(user:realm:pass))', () => {
    vi.stubEnv('ASTERISK_AUTH_REALM', 'asterisk');
    const digest = computeSipAuthMd5('shv_test0001', 'secret-pass');
    const expected = require('crypto')
      .createHash('md5')
      .update('shv_test0001:asterisk:secret-pass')
      .digest('hex');
    expect(digest).toBe(expected);
  });

  it('disable queues DISABLE_ENDPOINT and re-enable queues UPSERT_ENDPOINT', async () => {
    const account = makeAccount();
    (prisma as any).sipAccount.findFirst.mockResolvedValue(account);
    (prisma as any).sipAccount.update.mockImplementation(async ({ data }: any) => ({
      ...account,
      ...data,
    }));
    (prisma as any).provisioningTask.create.mockResolvedValue({ id: 't' });

    await updateSipAccount(ctx, 'org-1', 'sip-1', { status: 'DISABLED' });
    expect((prisma as any).provisioningTask.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DISABLE_ENDPOINT' }),
      })
    );

    (prisma as any).sipAccount.findFirst.mockResolvedValue(
      makeAccount({ status: 'DISABLED' })
    );
    await updateSipAccount(ctx, 'org-1', 'sip-1', { status: 'ACTIVE' });
    expect((prisma as any).provisioningTask.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'UPSERT_ENDPOINT' }),
      })
    );
  });

  it('does not queue a task when status does not change', async () => {
    const account = makeAccount();
    (prisma as any).sipAccount.findFirst.mockResolvedValue(account);
    (prisma as any).sipAccount.update.mockImplementation(async ({ data }: any) => ({ ...account, ...data }));

    await updateSipAccount(ctx, 'org-1', 'sip-1', { callerId: '+15559998888' });
    expect((prisma as any).provisioningTask.create).not.toHaveBeenCalled();
  });

  it('password reset queues a credential rotation task', async () => {
    const account = makeAccount();
    (prisma as any).sipAccount.findFirst.mockResolvedValue(account);
    (prisma as any).sipAccount.update.mockImplementation(async ({ data }: any) => ({ ...account, ...data }));
    (prisma as any).provisioningTask.create.mockResolvedValue({ id: 't' });

    await resetSipPassword(ctx, 'org-1', 'sip-1');
    expect((prisma as any).provisioningTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'UPSERT_ENDPOINT' }),
      })
    );
  });
});

describe('Provisioning pending/result endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GATEWAY_API_KEY', 'gateway-secret');
  });

  it('rejects unauthenticated polling', async () => {
    const res = await handlePending(gwRequest('/api/internal/gateway/provisioning/pending', undefined, ''));
    expect(res.status).toBe(401);
  });

  it('claims pending tasks and marks them PROCESSING', async () => {
    (prisma as any).provisioningTask.updateMany.mockResolvedValue({ count: 0 });
    (prisma as any).provisioningTask.findMany.mockResolvedValue([
      { id: 't-1', action: 'UPSERT_ENDPOINT', sipAccountId: 'sip-1', callId: null, payload: {} },
    ]);
    (prisma as any).provisioningTask.update.mockResolvedValue({});

    const res = await handlePending(gwRequest('/api/internal/gateway/provisioning/pending'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.tasks).toHaveLength(1);
    expect((prisma as any).provisioningTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-1' },
        data: expect.objectContaining({ status: 'PROCESSING' }),
      })
    );
  });

  it('successful result marks account PROVISIONED', async () => {
    (prisma as any).provisioningTask.findUnique.mockResolvedValue({
      id: 't-1',
      status: 'PROCESSING',
      sipAccountId: 'sip-1',
      attempts: 1,
    });

    await applyProvisioningResult('t-1', { ok: true });

    expect((prisma as any).sipAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sip-1' },
        data: expect.objectContaining({ provisioningState: 'PROVISIONED' }),
      })
    );
  });

  it('failed result marks the task FAILED and surfaces the error after retries exhaust', async () => {
    (prisma as any).provisioningTask.findUnique.mockResolvedValue({
      id: 't-1',
      status: 'PROCESSING',
      sipAccountId: 'sip-1',
      attempts: 5,
    });

    await applyProvisioningResult('t-1', { ok: false, error: 'reload failed' });

    expect((prisma as any).provisioningTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', lastError: 'reload failed' }),
      })
    );
    expect((prisma as any).sipAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provisioningState: 'FAILED', provisioningError: 'reload failed' }),
      })
    );
  });

  it('result reporting is idempotent for completed tasks', async () => {
    (prisma as any).provisioningTask.findUnique.mockResolvedValue({
      id: 't-1',
      status: ProvisioningTaskStatuses.DONE,
    });

    const out = await applyProvisioningResult('t-1', { ok: true });
    expect(out.applied).toBe(false);
    expect((prisma as any).provisioningTask.update).not.toHaveBeenCalled();
  });

  it('result endpoint rejects unauthenticated posts', async () => {
    const res = await handleResult(gwRequest('/api/internal/gateway/provisioning/result', { taskId: 't' }, ''));
    expect(res.status).toBe(401);
  });
});

describe('Registration state reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GATEWAY_API_KEY', 'gateway-secret');
  });

  it('rejects unauthenticated reports', async () => {
    const res = await handleRegistration(
      gwRequest('/api/internal/gateway/registration', { registrations: [] }, '')
    );
    expect(res.status).toBe(401);
  });

  it('stores REGISTERED state with contact info', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue({ id: 'sip-1' });
    (prisma as any).sipAccount.update.mockResolvedValue({});

    const res = await handleRegistration(
      gwRequest('/api/internal/gateway/registration', {
        registrations: [
          {
            username: 'shv_abc12345',
            registered: true,
            contactAddress: 'sip:shv_abc12345@203.0.113.10:5060',
            userAgent: 'Zoiper5',
          },
        ],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(1);
    expect((prisma as any).sipAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationStatus: 'REGISTERED',
          lastContactAddress: 'sip:shv_abc12345@203.0.113.10:5060',
        }),
      })
    );
  });

  it('stores UNREGISTERED and clears contact address', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue({ id: 'sip-1' });
    (prisma as any).sipAccount.update.mockResolvedValue({});

    await handleRegistration(
      gwRequest('/api/internal/gateway/registration', {
        registrations: [{ username: 'shv_abc12345', registered: false }],
      })
    );

    expect((prisma as any).sipAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationStatus: 'UNREGISTERED',
          lastContactAddress: null,
        }),
      })
    );
  });

  it('skips unknown usernames', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(null);

    const res = await handleRegistration(
      gwRequest('/api/internal/gateway/registration', {
        registrations: [{ username: 'shv_missing0', registered: true }],
      })
    );
    const json = await res.json();
    expect(json.data.updated).toBe(0);
  });
});

describe('Gateway call authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GATEWAY_API_KEY', 'gateway-secret');
    (prisma as any).$queryRaw.mockResolvedValue([{ id: 'wallet-1' }]);
  });

  function gatewayAccount(overrides: Record<string, unknown> = {}) {
    return {
      id: 'sip-1',
      organizationId: 'org-1',
      username: 'shv_abc12345',
      domain: 'sip.shivaksatechnology.com',
      status: 'ACTIVE',
      callerId: '+15551234567',
      maxConcurrentCalls: 1,
      transport: 'UDP',
      passwordCipher: 'c',
      passwordTag: 't',
      passwordIv: 'i',
      phoneNumbers: [],
      organization: {
        id: 'org-1',
        voipService: {
          status: 'ACTIVE',
          isAdminSuspended: false,
          customerRate: new Prisma.Decimal('0.05'),
          reserveMinutes: 5,
          maxCallDurationMinutes: 60,
        },
        wallet: { id: 'wallet-1', balance: new Prisma.Decimal('100'), reserved: new Prisma.Decimal('0') },
      },
      ...overrides,
    };
  }

  function gatewayCarrier(overrides: Record<string, unknown> = {}) {
    return {
      id: 'carrier-1',
      code: 'teloz',
      name: 'Teloz',
      type: 'SIP_GATEWAY',
      enabled: true,
      status: CarrierStatus.TEST,
      cliMode: CliMode.PASS_THROUGH,
      techPrefix: '78542',
      maxChannels: 100,
      maxCps: 10,
      defaultCallerId: null,
      gatewayEndpoint: 'teloz',
      organizationId: null,
      ...overrides,
    };
  }

  function gatewayPolicy(carrier = gatewayCarrier()) {
    return {
      id: 'pol-1',
      organizationId: null,
      countryIso: 'GR',
      destinationType: DestinationType.ALL,
      carrierId: carrier.id,
      priority: 1,
      enabled: true,
      maxCpsOverride: null,
      maxChannelsOverride: null,
      cliProfileId: null,
      carrier,
      cliProfile: null,
    };
  }

  function happyMocks(account: ReturnType<typeof gatewayAccount>) {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(account);
    (prisma as any).voipCall.count.mockResolvedValue(0);
    (prisma as any).voipCall.create.mockImplementation(async ({ data }: any) => ({
      id: 'call-1',
      ...data,
    }));
    (prisma as any).walletReservation.create.mockResolvedValue({});
    (prisma as any).wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: new Prisma.Decimal('100'),
      reserved: new Prisma.Decimal('0'),
    });
    (prisma as any).wallet.update.mockResolvedValue({
      id: 'wallet-1',
      balance: new Prisma.Decimal('97'),
      reserved: new Prisma.Decimal('0'),
    });
    (prisma as any).walletTransaction.findUnique.mockResolvedValue(null);
    (prisma as any).walletTransaction.create.mockResolvedValue({});
    (prisma as any).walletReservation.findUnique.mockResolvedValue({
      id: 'res-1',
      status: 'ACTIVE',
      walletId: 'wallet-1',
      callId: 'call-1',
      amount: new Prisma.Decimal('3'),
      wallet: { id: 'wallet-1', balance: new Prisma.Decimal('100') },
    });
    (prisma as any).voipCall.update.mockImplementation(async ({ data }: any) => data);
    (prisma as any).carrierRate.findMany.mockResolvedValue([
      {
        id: 'rate-1',
        carrierId: 'carrier-1',
        prefix: '30',
        destinationType: DestinationType.ALL,
        rate: new Prisma.Decimal('0.018'),
        billingIncrementSeconds: 1,
        minimumBillableSeconds: 1,
        enabled: true,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        priority: 0,
        carrier: gatewayCarrier(),
      },
    ]);
    (prisma as any).carrierRoutePolicy.findMany.mockResolvedValue([gatewayPolicy()]);
  }

  it('authorizes a call, routes to a SIP gateway carrier, and enforces server-side CLI', async () => {
    happyMocks(gatewayAccount());

    const result = await authorizeAndRouteGatewayCall({
      username: 'shv_abc12345',
      destination: '+306912345678',
      channel: 'PJSIP/shv_abc12345-00000001',
    });

    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.carrierEndpoint).toBe('teloz');
    expect(result.dialString).toBe('78542306912345678');
    // Caller ID comes from policy (account callerId in PASS_THROUGH), never
    // from anything the customer softphone supplied.
    expect(result.callerId).toBe('+15551234567');
    expect(result.maxDurationSeconds).toBe(3600);

    const callUpdate = (prisma as any).voipCall.update.mock.calls.at(-1)[0].data;
    expect(callUpdate.carrierId).toBe('carrier-1');
    expect(callUpdate.gatewayCallId).toMatch(/^gw_/);
    expect(callUpdate.routingInfo.asteriskChannel).toBe('PJSIP/shv_abc12345-00000001');
  });

  it('uses carrier.gatewayEndpoint override when set', async () => {
    const account = gatewayAccount();
    happyMocks(account);
    (prisma as any).carrierRoutePolicy.findMany.mockResolvedValue([
      gatewayPolicy(gatewayCarrier({ gatewayEndpoint: 'carrier-teloz-eu' })),
    ]);

    const result = await authorizeAndRouteGatewayCall({
      username: 'shv_abc12345',
      destination: '+306912345678',
    });
    expect(result.authorized).toBe(true);
    if (result.authorized) expect(result.carrierEndpoint).toBe('carrier-teloz-eu');
  });

  it('rejects unknown SIP usernames', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(null);
    const result = await authorizeAndRouteGatewayCall({
      username: 'shv_nope1234',
      destination: '+306912345678',
    });
    expect(result.authorized).toBe(false);
  });

  it('rejects calls from disabled accounts', async () => {
    (prisma as any).sipAccount.findUnique.mockResolvedValue(
      gatewayAccount({ status: 'DISABLED' })
    );
    const result = await authorizeAndRouteGatewayCall({
      username: 'shv_abc12345',
      destination: '+306912345678',
    });
    expect(result).toMatchObject({ authorized: false, hangupCause: 21 });
    expect((prisma as any).voipCall.create).not.toHaveBeenCalled();
  });

  it('rejects calls beyond maxConcurrentCalls and reserves nothing', async () => {
    const account = gatewayAccount({ maxConcurrentCalls: 1 });
    happyMocks(account);
    (prisma as any).voipCall.count.mockResolvedValue(1);

    const result = await authorizeAndRouteGatewayCall({
      username: 'shv_abc12345',
      destination: '+306912345678',
    });
    expect(result).toMatchObject({ authorized: false, hangupCause: 17 });
    expect((prisma as any).walletReservation.create).not.toHaveBeenCalled();
  });

  it('rejects calls for suspended organizations', async () => {
    const account = gatewayAccount();
    account.organization.voipService.isAdminSuspended = true;
    (prisma as any).sipAccount.findUnique.mockResolvedValue(account);

    const result = await authorizeAndRouteGatewayCall({
      username: 'shv_abc12345',
      destination: '+306912345678',
    });
    expect(result.authorized).toBe(false);
  });

  it('rejects when no SIP_GATEWAY carrier can serve the destination', async () => {
    const account = gatewayAccount();
    happyMocks(account);
    // Only an API-type carrier is routed — Asterisk cannot dial it.
    (prisma as any).carrierRoutePolicy.findMany.mockResolvedValue([
      gatewayPolicy(gatewayCarrier({ type: 'API', code: 'telnyx' })),
    ]);

    const result = await authorizeAndRouteGatewayCall({
      username: 'shv_abc12345',
      destination: '+306912345678',
    });
    expect(result).toMatchObject({ authorized: false, hangupCause: 34 });
    // Reservation released and call marked FAILED, not billed.
    expect((prisma as any).voipCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    );
  });
});
