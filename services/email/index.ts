interface PasswordResetEmailInput {
  to: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
}

interface EmailResult {
  success: boolean;
  message?: string;
}

/**
 * Email service abstraction.
 * In production, this should integrate with a real SMTP/email provider.
 * In development, it logs to the console safely (no secrets exposed).
 */
export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<EmailResult> {
  if (process.env.NODE_ENV === 'development') {
    // Development mode: log a non-sensitive message with the reset link
    // The reset link is NOT a secret - it is sent to the user's email.
    // However, in development, we avoid real email delivery by logging it.
    console.log('[DEV MODE] Password reset email would be sent to:', input.to);
    console.log('[DEV MODE] Reset URL:', input.resetUrl);
    console.log('[DEV MODE] Expires at:', input.expiresAt);
    return { success: true, message: 'Development: email logged to console' };
  }

  // Production: integrate with SMTP or email service
  // Example: nodemailer, SendGrid, AWS SES, etc.
  // TODO: Implement production email provider
  console.error('Production email provider not configured');
  return { success: false, message: 'Email provider not configured' };
}
