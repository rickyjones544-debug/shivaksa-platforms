import { prisma } from '@/lib/db/prisma';
import { hashToken, generateSessionToken } from './session';
import { hashPassword } from './password';
import { sendPasswordResetEmail } from '@/services/email';

const RESET_TOKEN_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export type ResetRequestResult =
  | { success: true; message: string }
  | { success: false; error: string };

export type ResetConfirmResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Request a password reset.
 * Always returns a generic success message to prevent email enumeration.
 */
export async function requestPasswordReset(email: string): Promise<ResetRequestResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    // Return generic success to prevent email enumeration
    return { success: true, message: 'If an account exists, a reset email has been sent' };
  }

  // Generate secure token and hash
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MAX_AGE_MS);

  // Invalidate any existing unused tokens for this user
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  await prisma.passwordReset.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  // Send reset email via abstraction
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresAt,
  });

  return { success: true, message: 'If an account exists, a reset email has been sent' };
}

/**
 * Confirm password reset with token and new password.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<ResetConfirmResult> {
  const tokenHash = hashToken(token);

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord) {
    return { success: false, error: 'Invalid or expired reset token' };
  }

  if (resetRecord.used) {
    return { success: false, error: 'Reset token has already been used' };
  }

  if (new Date() > resetRecord.expiresAt) {
    return { success: false, error: 'Reset token has expired' };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    }),
    prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true },
    }),
    // Revoke all active sessions for the user
    prisma.session.updateMany({
      where: { userId: resetRecord.userId },
      data: { revoked: true },
    }),
  ]);

  return { success: true, message: 'Password has been reset successfully' };
}
