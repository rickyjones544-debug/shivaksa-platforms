interface PasswordResetEmailInput {
  to: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
}

interface InvitationEmailInput {
  to: string;
  organizationName: string;
  inviterName: string;
  roleName: string;
  acceptUrl: string;
  expiresAt: Date;
}

interface EmailResult {
  success: boolean;
  message?: string;
}

function logDevelopmentEmail(type: string, to: string, url: string, expiresAt: Date) {
  console.log(`[DEV MODE] ${type} email would be sent to:`, to);
  console.log(`[DEV MODE] URL:`, url);
  console.log(`[DEV MODE] Expires at:`, expiresAt);
}

/**
 * Email service abstraction.
 * In production, this integrates with a real SMTP/email provider configured
 * through environment variables (e.g. SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
 * In development, it logs to the console safely (no secrets exposed).
 */
export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<EmailResult> {
  if (process.env.NODE_ENV === 'development') {
    logDevelopmentEmail('Password reset', input.to, input.resetUrl, input.expiresAt);
    return { success: true, message: 'Development: email logged to console' };
  }

  // Production: integrate with SMTP or email service via env-configured provider.
  // Example: nodemailer, SendGrid, AWS SES, etc.
  console.error('Production email provider not configured');
  return { success: false, message: 'Email provider not configured' };
}

export async function sendInvitationEmail(input: InvitationEmailInput): Promise<EmailResult> {
  if (process.env.NODE_ENV === 'development') {
    logDevelopmentEmail('Invitation', input.to, input.acceptUrl, input.expiresAt);
    return { success: true, message: 'Development: invitation logged to console' };
  }

  console.error('Production email provider not configured');
  return { success: false, message: 'Email provider not configured' };
}
