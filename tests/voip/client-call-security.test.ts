import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/voip/calls/route';
import { getCurrentUser } from '@/lib/auth/auth';
import { initiateOutboundCall, listCalls } from '@/lib/voip/services/calls';
import { getRolePermissions } from '@/lib/rbac/roles';
import { toCustomerCallDto, toCustomerSipAccountDto } from '@/lib/voip/dto/customer';

vi.mock('@/lib/auth/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/rbac/authorization', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/rbac/authorization')>();
  return {
    ...original,
    hasPermission: vi.fn(() => true),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => true),
}));

vi.mock('@/lib/voip/services/wallet', () => ({
  InsufficientBalanceError: class InsufficientBalanceError extends Error {},
}));

vi.mock('@/lib/voip/services/call-authorization', () => ({
  CallAuthorizationError: class CallAuthorizationError extends Error {},
}));

vi.mock('@/lib/voip/services/calls', () => ({
  initiateOutboundCall: vi.fn(),
  listCalls: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedInitiateOutboundCall = vi.mocked(initiateOutboundCall);
const mockedListCalls = vi.mocked(listCalls);

const ctx = {
  user: { id: 'user-1', name: 'Client Support', email: 'support@example.com', isSuperAdmin: false },
  membership: { id: 'member-1', organizationId: 'org-1', roleId: 'role-1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Tenant One', slug: 'tenant-one' },
  role: { id: 'role-1', name: 'CLIENT_VOIP_SUPPORT' },
  permissions: [
    'voip:read:calls',
    'voip:write:calls',
    'voip:read:sip',
    'voip:read:numbers',
    'wallet:read',
  ],
};

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/voip/calls', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
    body: JSON.stringify(body),
  });
}

describe('client VoIP security boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentUser.mockResolvedValue(ctx as never);
  });

  it('grants CLIENT_VOIP_SUPPORT only the approved tenant-scoped permissions', () => {
    expect(getRolePermissions('CLIENT_VOIP_SUPPORT')).toEqual([
      'voip:read:calls',
      'voip:write:calls',
      'voip:read:sip',
      'voip:read:numbers',
      'wallet:read',
    ]);
    expect(getRolePermissions('CLIENT_VOIP_SUPPORT')).not.toContain('voip:manage');
    expect(getRolePermissions('CLIENT_VOIP_SUPPORT')).not.toContain('voip:write:sip');
    expect(getRolePermissions('CLIENT_VOIP_SUPPORT')).not.toContain('wallet:write');
    expect(getRolePermissions('CLIENT_VOIP_SUPPORT')).not.toContain('wallet:manage');
    expect(getRolePermissions('CLIENT_VOIP_SUPPORT').some((key) => key.startsWith('carrier'))).toBe(
      false
    );
    expect(getRolePermissions('CLIENT_VOIP_SUPPORT').some((key) => key.startsWith('admin'))).toBe(
      false
    );
  });

  it('discards client-supplied carrier and caller-ID controls and hides internal route data', async () => {
    mockedInitiateOutboundCall.mockResolvedValue({
      callId: 'call-1',
      providerCallId: 'provider-call-1',
      callerId: '14157040768',
      destination: '+302614511198',
      maxDurationMinutes: 10,
      route: {
        carrier: {
          code: 'private-carrier-code',
          name: 'Private Carrier Name',
          remoteHost: '203.0.113.20',
          techPrefix: '99999',
        },
        rate: { rate: '0.001', wholesaleCost: '0.50' },
        dialString: '99999302614511198',
        internalSipUri: 'sip:private@203.0.113.20:5060',
      },
    } as never);

    const response = await POST(
      postRequest({
        sipAccountId: 'sip-1',
        destination: '+302614511198',
        preferredCarrierCode: 'attacker-selected-carrier',
        carrierId: 'attacker-selected-carrier-id',
        routePolicyId: 'attacker-selected-route-policy',
        suppliedCallerId: 'attacker-selected-cli',
        carrierCredentials: 'secret',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockedInitiateOutboundCall).toHaveBeenCalledWith(ctx, {
      sipAccountId: 'sip-1',
      destination: '+302614511198',
    });
    expect(json.data).toEqual({
      callId: 'call-1',
      callerId: '14157040768',
      destination: '+302614511198',
      maxDurationMinutes: 10,
    });

    const serialized = JSON.stringify(json);
    for (const privateValue of [
      'provider-call-1',
      'private-carrier-code',
      'Private Carrier Name',
      '203.0.113.20',
      '99999',
      '0.001',
      '0.50',
      '99999302614511198',
      'sip:private@203.0.113.20:5060',
      'secret',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('uses only the authenticated organization when listing calls', async () => {
    mockedListCalls.mockResolvedValue([]);

    const response = await GET(
      new NextRequest('http://localhost/api/voip/calls?take=25', {
        headers: { 'x-forwarded-for': '198.51.100.11' },
      })
    );

    expect(response.status).toBe(200);
    expect(mockedListCalls).toHaveBeenCalledWith('org-1', 25, 0);
    expect(mockedListCalls).not.toHaveBeenCalledWith('org-2', expect.anything(), expect.anything());
  });

  it('customer DTOs omit injected carrier, credential, wholesale, and tenant fields', () => {
    const call = toCustomerCallDto({
      id: 'call-1',
      direction: 'OUTBOUND',
      callerId: '14157040768',
      destination: '+302614511198',
      status: 'COMPLETED',
      startTime: new Date('2026-09-21T00:00:00Z'),
      answerTime: new Date('2026-09-21T00:00:01Z'),
      endTime: new Date('2026-09-21T00:01:00Z'),
      durationSeconds: 59,
      billableSeconds: 60,
      billedMinutes: { toString: () => '1' } as never,
      customerCharge: { toString: () => '0.10' } as never,
      customerRate: { toString: () => '0.10' } as never,
      createdAt: new Date('2026-09-21T00:00:00Z'),
      carrier: { name: 'Private Carrier', remoteHost: '203.0.113.20' },
      carrierCode: 'private-code',
      carrierCredentials: 'secret',
      techPrefix: '99999',
      wholesaleRate: '0.001',
      wholesaleCost: '0.50',
      internalSipUri: 'sip:private@203.0.113.20:5060',
      organizationId: 'org-2',
    } as never);
    const sip = toCustomerSipAccountDto({
      id: 'sip-1',
      username: 'tenant-user',
      domain: 'sip.example.com',
      status: 'ACTIVE',
      callerId: '14157040768',
      phoneNumbers: [],
      passwordCipher: 'cipher',
      passwordTag: 'tag',
      passwordIv: 'iv',
      organizationId: 'org-2',
      providerConfig: { carrier: 'private-code' },
    } as never);

    const serialized = JSON.stringify({ call, sip });
    for (const privateValue of [
      'Private Carrier',
      '203.0.113.20',
      'private-code',
      'secret',
      '99999',
      '0.001',
      '0.50',
      'sip:private@203.0.113.20:5060',
      'org-2',
      'cipher',
      'tag',
      'iv',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });
});
