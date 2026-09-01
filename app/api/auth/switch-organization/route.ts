import { NextRequest, NextResponse } from 'next/server';
import { switchOrganization } from '@/lib/auth/switch-org';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const result = await switchOrganization(organizationId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error === 'Unauthorized' ? 401 : 403 }
      );
    }

    return NextResponse.json({ success: true, ctx: result.ctx });
  } catch (error) {
    console.error('Switch organization error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
