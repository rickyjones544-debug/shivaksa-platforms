import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { resolveAuthContext } from '@/lib/tenant/context';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from './password';
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  getSessionToken,
  revokeSession,
} from './session';
import { validateLogin, validateRegistration } from './validation';

const GENERIC_AUTH_ERROR = 'Invalid email or password';
const GENERIC_SUSPENDED_ERROR = 'Account is suspended';

// Re-export for consumers
export type { AuthenticatedContext } from '@/lib/rbac/authorization';

export type AuthResult =
  | { success: true; ctx: AuthenticatedContext }
  | { success: false; error: string };

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  const validation = validateLogin({ email, password });
  if (!validation.valid) {
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  if (user.status === 'SUSPENDED') {
    return { success: false, error: GENERIC_SUSPENDED_ERROR };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  const ctx = await resolveAuthContext(user.id);
  if (!ctx) {
    return { success: false, error: 'No active organization membership' };
  }

  const membershipId = ctx.membership?.id;
  const { token, expiresAt } = await createSession(user.id, membershipId);
  await setSessionCookie(token, expiresAt);

  return { success: true, ctx };
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthResult> {
  const validation = validateRegistration(data);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0];
    return { success: false, error: firstError || 'Invalid registration data' };
  }

  const passwordCheck = validatePasswordStrength(data.password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.message || 'Password is too weak' };
  }

  const email = data.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' };
  }

  const isFirstUser = (await prisma.user.count()) === 0;
  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email,
      passwordHash,
      status: 'PENDING',
      isSuperAdmin: isFirstUser,
    },
  });

  // Create default organization and membership for the registering user.
  const organizationName = `${data.name.trim()}'s Organization`;
  const slugBase = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const organization = await prisma.organization.create({
    data: {
      name: organizationName,
      slug,
      status: 'ACTIVE',
    },
  });

  const clientAdminRole = await prisma.role.findUnique({
    where: { name: 'CLIENT_ADMIN' },
  });

  if (!clientAdminRole) {
    return { success: false, error: 'Default organization role not found' };
  }

  const membership = await prisma.organizationMembership.create({
    data: {
      userId: user.id,
      organizationId: organization.id,
      roleId: clientAdminRole.id,
      status: 'ACTIVE',
    },
  });

  const ctx = await resolveAuthContext(user.id, membership.id);
  if (!ctx) {
    return { success: false, error: 'Failed to resolve auth context' };
  }

  const { token, expiresAt } = await createSession(user.id, membership.id);
  await setSessionCookie(token, expiresAt);

  return { success: true, ctx };
}

export async function logoutUser(): Promise<{ success: boolean }> {
  const token = await getSessionToken();
  if (token) {
    await revokeSession(token);
  }
  await clearSessionCookie();
  return { success: true };
}

export async function getCurrentUser(): Promise<AuthenticatedContext | null> {
  const token = await getSessionToken();
  const session = await getSession(token);
  if (!session) return null;

  return resolveAuthContext(session.user.id, session.membershipId ?? undefined);
}

export async function requireAuth(): Promise<AuthenticatedContext> {
  const ctx = await getCurrentUser();
  if (!ctx) {
    throw new Error('Unauthorized');
  }
  return ctx;
}
