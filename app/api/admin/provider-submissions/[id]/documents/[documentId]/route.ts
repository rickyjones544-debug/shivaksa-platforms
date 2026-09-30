import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/auth';
import { hasPermission } from '@/lib/rbac/authorization';
import { getSubmissionDocument } from '@/lib/wholesale-profile/services/documents';
import { SubmissionError } from '@/lib/wholesale-profile/services/submission';

// Internal document retrieval — streams the object from private storage to
// an authorized staff member. No public URL, no storage key disclosure.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(ctx, 'provider', 'read', 'submissions')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id, documentId } = await params;
    const doc = await getSubmissionDocument(ctx, id, documentId);

    return new NextResponse(new Uint8Array(doc.buffer), {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': String(doc.sizeBytes),
        'Content-Disposition': `attachment; filename="${doc.fileName.replace(/"/g, '')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  } catch (error) {
    if (error instanceof SubmissionError) {
      const status =
        error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    throw error;
  }
}
