import { randomBytes, createHash } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

const SESSION_COOKIE_NAME = 'shivaksa-session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a cryptographically secure random token.
 * Returns a hex string.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256.
 * Store only hashes in the database.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new server-side session for a user.
 * Returns the raw token (for cookie) and stores the hash.
 */
export async function createSession(userId: string, membershipId?: string) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      membershipId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Look up a session by raw token.
 * Returns null if invalid, expired, or revoked.
 */
export async function getSession(token: string | undefined) {
  if (!token) return null;

  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revoked) return null;
  if (new Date() > session.expiresAt) return null;

  return session;
}

/**
 * Get the authenticated user from a session token.
 * Returns null if session is invalid, expired, or revoked.
 */
export async function getUserFromSession(token: string | undefined) {
  const session = await getSession(token);
  return session?.user ?? null;
}

/**
 * Update the active membership on an existing session.
 * Used when a user switches organizations.
 */
export async function setSessionMembership(token: string, membershipId: string) {
  const tokenHash = hashToken(token);
  await prisma.session.updateMany({
    where: { tokenHash },
    data: { membershipId },
  });
}

/**
 * Revoke/invalidate a session.
 */
export async function revokeSession(token: string) {
  const tokenHash = hashToken(token);
  await prisma.session.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}

/**
 * Set the session cookie in the response.
 * HttpOnly, Secure in production, SameSite strict.
 */
export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

/**
 * Clear the session cookie.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

/**
 * Get the session token from the request cookies.
 */
export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Clean up expired sessions from the database.
 * Can be called periodically or on demand.
 */
export async function cleanupExpiredSessions() {
  await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revoked: true }],
    },
  });
}
