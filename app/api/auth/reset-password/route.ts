import { NextRequest, NextResponse } from 'next/server';
import {
  requestPasswordReset,
  confirmPasswordReset,
} from '@/lib/auth/password-reset';
import { validatePasswordStrength } from '@/lib/auth/password';
import { validateResetRequest, validateResetConfirm } from '@/lib/auth/validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, 'reset-password', 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many reset attempts. Please try again later.' },
        { status: 429 }
      );
    }
    const body = await request.json();

    // Handle reset request (email only)
    if (body.email && !body.token) {
      const validation = validateResetRequest({ email: body.email });
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: Object.values(validation.errors)[0] },
          { status: 400 }
        );
      }

      const result = await requestPasswordReset(body.email);
      return NextResponse.json(result);
    }

    // Handle reset confirmation (token + new password)
    if (body.token && body.password) {
      const validation = validateResetConfirm({
        token: body.token,
        password: body.password,
        confirmPassword: body.confirmPassword || body.password,
      });

      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: Object.values(validation.errors)[0] },
          { status: 400 }
        );
      }

      const passwordCheck = validatePasswordStrength(body.password);
      if (!passwordCheck.valid) {
        return NextResponse.json(
          { success: false, error: passwordCheck.message },
          { status: 400 }
        );
      }

      const result = await confirmPasswordReset(body.token, body.password);
      if (!result.success) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during password reset' },
      { status: 500 }
    );
  }
}
