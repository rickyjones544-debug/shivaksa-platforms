import { describe, it, expect } from 'vitest';
import { belongsToOrganization } from '@/lib/rbac/authorization';
import { toCustomerSipAccountDto } from '@/lib/voip/dto/customer';
import { checkRateLimit } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';

function makeRequest(ip: string) {
  return {
    headers: {
      get: (name: string) => (name === 'x-forwarded-for' ? ip : null),
    },
  } as unknown as NextRequest;
}

describe('Phase 1 security hardening', () => {
  it('SIP password is never returned in customer DTO', () => {
    const dto = toCustomerSipAccountDto({
      id: '1',
      username: 'u',
      domain: 'd',
      status: 'ACTIVE',
      callerId: null,
      phoneNumbers: [{ number: '+15551234567' }],
    });
    expect(dto).not.toHaveProperty('password');
    expect(dto).toHaveProperty('username', 'u');
    expect(dto).toHaveProperty('domain', 'd');
  });

  it('super admin can administer any organization', () => {
    const ctx = {
      user: { id: 'u1', name: 'Admin', email: 'a@a.com', isSuperAdmin: true },
      membership: null,
      organization: null,
      role: null,
      permissions: [],
    };
    expect(belongsToOrganization(ctx, 'org-2')).toBe(true);
  });

  it('regular user can only administer their own organization', () => {
    const ctx = {
      user: { id: 'u1', name: 'User', email: 'u@a.com', isSuperAdmin: false },
      membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
      organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
      role: { id: 'r1', name: 'CLIENT_ADMIN' },
      permissions: [],
    };
    expect(belongsToOrganization(ctx, 'org-1')).toBe(true);
    expect(belongsToOrganization(ctx, 'org-2')).toBe(false);
  });

  it('rate limiter blocks after max attempts', () => {
    const req = makeRequest('1.2.3.4');
    for (let i = 0; i < 5; i += 1) {
      expect(checkRateLimit(req, 'test', 5, 60000)).toBe(true);
    }
    expect(checkRateLimit(req, 'test', 5, 60000)).toBe(false);
  });

  it('rate limiter resets the counter after the window', async () => {
    const req = makeRequest('1.2.3.5');
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit(req, 'test', 3, 1000)).toBe(true);
    }
    expect(checkRateLimit(req, 'test', 3, 1000)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(checkRateLimit(req, 'test', 3, 1000)).toBe(true);
  });
});
