import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import {
  getProviderSubmission,
  setProviderSubmissionStatus,
  SubmissionError,
} from '@/lib/wholesale-profile/services/submission';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(ctx, 'provider', 'read', 'submissions')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const submission = await getProviderSubmission(ctx, id);
    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    if (error instanceof SubmissionError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    throw error;
  }
}

const DECISION_STATUSES = new Set(['REVIEWING', 'ACCEPTED', 'REJECTED']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(ctx, 'provider', 'write', 'submissions')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: { status?: string; reviewNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.status || !DECISION_STATUSES.has(body.status)) {
    return NextResponse.json(
      { success: false, error: 'status must be REVIEWING, ACCEPTED, or REJECTED' },
      { status: 400 }
    );
  }

  try {
    const { id } = await params;
    const submission = await setProviderSubmissionStatus(
      ctx,
      id,
      body.status as 'REVIEWING' | 'ACCEPTED' | 'REJECTED',
      typeof body.reviewNotes === 'string' ? body.reviewNotes.slice(0, 4000) : undefined
    );
    return NextResponse.json({ success: true, data: submission });
  } catch (error) {
    if (error instanceof SubmissionError) {
      const status =
        error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : error.code === 'STATE' ? 409 : 400;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    throw error;
  }
}
