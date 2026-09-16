import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, 'register', 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, password, confirmPassword } = body;

    // Explicitly remove any client-provided role to prevent privilege escalation
    const result = await registerUser({
      name,
      email,
      password,
      confirmPassword,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ctx: result.ctx,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
