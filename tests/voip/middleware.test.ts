import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '../../app/middleware';

describe('VoIP route protection', () => {
  it('redirects unauthenticated /voip to /login', () => {
    const request = new NextRequest(new URL('https://app.shivaksatechnology.com/voip'));
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toMatch(/^https?:\/\/.*\/login/);
  });

  it('does not redirect when session cookie is present', () => {
    const request = new NextRequest(new URL('https://app.shivaksatechnology.com/voip'), {
      headers: new Headers({ cookie: 'shivaksa-session=valid-token' }),
    });
    const response = middleware(request);
    expect(response.status).toBe(200);
  });

  it('matches /voip and /voip/:path*', () => {
    expect(config.matcher).toContain('/voip');
    expect(config.matcher).toContain('/voip/:path*');
  });
});
