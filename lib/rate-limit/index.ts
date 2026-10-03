import { NextRequest } from 'next/server';

type LimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, LimitEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

export function getRateLimitIdentifier(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const addresses = forwarded.split(',').map((address) => address.trim()).filter(Boolean);
    return addresses.at(-1) || 'anonymous';
  }
  return 'anonymous';
}

export function checkRateLimit(
  request: NextRequest,
  key: string,
  max: number,
  windowMs: number
): boolean {
  return checkIdentifierRateLimit(getRateLimitIdentifier(request), key, max, windowMs);
}

export function checkIdentifierRateLimit(
  identifier: string,
  key: string,
  max: number,
  windowMs: number
): boolean {
  cleanup();
  const fullKey = `${identifier}:${key}`;
  const now = Date.now();
  const entry = store.get(fullKey);

  if (!entry || entry.resetAt < now) {
    store.set(fullKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  entry.count += 1;
  return true;
}
