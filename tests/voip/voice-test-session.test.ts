import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createVoiceTestSession } from '@/app/api/admin/voice-test/session/route';
import { getCurrentUser } from '@/lib/auth/auth';

vi.mock('@/lib/auth/auth', () => ({
  getCurrentUser: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/voice-test/session', {
    method: 'POST',
  });
}

function makeCtx(isSuperAdmin: boolean) {
  return {
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com', isSuperAdmin },
    membership: { id: 'm-1', organizationId: 'org-1', roleId: 'r-1', status: 'ACTIVE' },
    organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    role: { id: 'r-1', name: isSuperAdmin ? 'SUPER_ADMIN' : 'CLIENT_ADMIN' },
    permissions: [] as string[],
  };
}

function stubValidConfig() {
  vi.stubEnv('WEBRTC_TEST_WSS_URL', 'wss://app.shivaksatechnology.com/ws');
  vi.stubEnv('WEBRTC_TEST_SIP_URI', 'sip:shivaksa-webrtc-test@app.shivaksatechnology.com');
  vi.stubEnv('WEBRTC_TEST_SIP_USERNAME', 'shivaksa-webrtc-test');
  vi.stubEnv('WEBRTC_TEST_SIP_PASSWORD', 'unit-test-password');
}

describe('POST /api/admin/voice-test/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const res = await createVoiceTestSession(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('rejects authenticated non-SUPER_ADMIN with 403', async () => {
    mockedGetCurrentUser.mockResolvedValue(makeCtx(false) as never);
    const res = await createVoiceTestSession(makeRequest());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('rejects a user holding voip:manage but not SUPER_ADMIN with 403', async () => {
    const ctx = makeCtx(false);
    ctx.permissions = ['voip:manage'];
    mockedGetCurrentUser.mockResolvedValue(ctx as never);
    const res = await createVoiceTestSession(makeRequest());
    expect(res.status).toBe(403);
  });

  it('fails safely with 500 when configuration is missing', async () => {
    mockedGetCurrentUser.mockResolvedValue(makeCtx(true) as never);
    vi.stubEnv('WEBRTC_TEST_WSS_URL', undefined as unknown as string);
    vi.stubEnv('WEBRTC_TEST_SIP_URI', undefined as unknown as string);
    vi.stubEnv('WEBRTC_TEST_SIP_USERNAME', undefined as unknown as string);
    vi.stubEnv('WEBRTC_TEST_SIP_PASSWORD', undefined as unknown as string);
    const res = await createVoiceTestSession(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Voice test is not configured');
    // must not leak any secret-shaped fields on failure
    expect(json.password).toBeUndefined();
    expect(json.uri).toBeUndefined();
  });

  it('returns the expected session shape for SUPER_ADMIN', async () => {
    mockedGetCurrentUser.mockResolvedValue(makeCtx(true) as never);
    stubValidConfig();
    const res = await createVoiceTestSession(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.wssUrl).toBe('wss://app.shivaksatechnology.com/ws');
    expect(json.uri).toBe('sip:shivaksa-webrtc-test@app.shivaksatechnology.com');
    expect(json.username).toBe('shivaksa-webrtc-test');
    expect(typeof json.password).toBe('string');
    expect(json.displayName).toBeTruthy();
    expect(Number.isNaN(Date.parse(json.expiresAt))).toBe(false);
    // exactly the fields the browser needs — nothing else
    expect(Object.keys(json).sort()).toEqual(
      ['displayName', 'expiresAt', 'password', 'success', 'uri', 'username', 'wssUrl'].sort()
    );
  });
});
