import { prisma } from '@/lib/db/prisma';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from './password';
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getUserFromSession,
  getSessionToken,
  revokeSession,
  generateSessionToken,
  hashToken,
} from './session';
import { validateLogin, validateRegistration } from './validation';

const GENERIC_AUTH_ERROR = 'Invalid email or password';
const GENERIC_SUSPENDED_ERROR = 'Account is suspended';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type AuthResult =
  | { success: true; user: AuthUser }
  | { success: false; error: string };

function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

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

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  return { success: true, user: toAuthUser(user) };
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

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });

  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' };
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      status: 'PENDING',
      role: 'CLIENT_VIEWER', // Default role; admin roles must be assigned by an admin in Phase 3
    },
  });

  return { success: true, user: toAuthUser(user) };
}

export async function logoutUser(): Promise<{ success: boolean }> {
  const token = await getSessionToken();
  if (token) {
    await revokeSession(token);
  }
  await clearSessionCookie();
  return { success: true };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  const user = await getUserFromSession(token);
  if (!user) return null;
  return toAuthUser(user);
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
