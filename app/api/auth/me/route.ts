import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/auth';

export async function GET() {
  try {
    const ctx = await getCurrentUser();

    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      ctx,
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
