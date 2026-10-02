import { describe, it, expect, vi } from 'vitest';
import * as logoutRoute from '@/app/api/auth/logout/route';
import { logoutUser } from '@/lib/auth/auth';

vi.mock('@/lib/auth/auth', () => ({
  logoutUser: vi.fn().mockResolvedValue({ success: true }),
}));

describe('logout route', () => {
  it('exposes POST only — no GET mutation surface', () => {
    expect(typeof logoutRoute.POST).toBe('function');
    expect((logoutRoute as any).GET).toBeUndefined();
    expect((logoutRoute as any).PUT).toBeUndefined();
    expect((logoutRoute as any).DELETE).toBeUndefined();
  });

  it('POST clears the session and reports success', async () => {
    const res = await logoutRoute.POST();
    expect(logoutUser).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
