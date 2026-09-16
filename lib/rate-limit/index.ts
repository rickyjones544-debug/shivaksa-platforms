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
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'anonymous';
}

export function checkRateLimit(
  request: NextRequest,
  key: string,
  max: number,
  windowMs: number
): boolean {
  cleanup();
  const id = getRateLimitIdentifier(request);
  const fullKey = `${id}:${key}`;
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
