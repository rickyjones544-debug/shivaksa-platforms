import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import {
  promoteSubmissionToProvider,
  SubmissionError,
} from '@/lib/wholesale-profile/services/submission';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(ctx, 'provider', 'write', 'submissions')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: { existingProviderId?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const { id } = await params;
    const result = await promoteSubmissionToProvider(ctx, id, {
      existingProviderId:
        typeof body.existingProviderId === 'string' ? body.existingProviderId : undefined,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof SubmissionError) {
      const status =
        error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : error.code === 'STATE' ? 409 : 400;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    throw error;
  }
}
