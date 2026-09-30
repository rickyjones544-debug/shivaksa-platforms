import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { uploadProviderDocument } from '@/lib/wholesale-profile/services/documents';
import { SubmissionError } from '@/lib/wholesale-profile/services/submission';
import { MAX_DOCUMENT_BYTES } from '@/lib/wholesale-profile/validation/documents';

const UPLOAD_RATE_LIMIT = 10;
const UPLOAD_RATE_WINDOW_MS = 10 * 60 * 1000;
// Multipart body cap — file limit plus small overhead for form fields.
const MAX_REQUEST_BYTES = MAX_DOCUMENT_BYTES + 64 * 1024;

const UNAVAILABLE = 'This wholesale partnership link is no longer accepting submissions.';

function secureJson(body: unknown, status: number): NextResponse {
  const res = NextResponse.json(body, { status });
  res.headers.set('Cache-Control', 'no-store, private');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res;
}

// Provider document upload — bearer-token scoped. Ownership chain:
// token → onboarding link → organization → (later) submission snapshot.
// The provider never supplies organization/submission/document selectors.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!checkRateLimit(request, 'wholesale-document', UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_MS)) {
    return secureJson({ success: false, error: UNAVAILABLE }, 429);
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) {
        return secureJson({ success: false, error: UNAVAILABLE }, 403);
      }
    } catch {
      return secureJson({ success: false, error: UNAVAILABLE }, 403);
    }
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return secureJson({ success: false, error: 'File exceeds the 10 MB limit' }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return secureJson({ success: false, error: 'Invalid request body' }, 400);
  }

  const file = form.get('file');
  const category = form.get('category');
  const description = form.get('description');

  if (!(file instanceof File)) {
    return secureJson({ success: false, error: 'A document file is required' }, 400);
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return secureJson({ success: false, error: 'File exceeds the 10 MB limit' }, 413);
  }

  const { token } = await params;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const doc = await uploadProviderDocument(token, {
      category: typeof category === 'string' ? category : '',
      fileName: file.name,
      mimeType: file.type,
      description: typeof description === 'string' ? description : undefined,
      buffer,
    });
    return secureJson({ success: true, data: doc }, 200);
  } catch (error) {
    if (error instanceof SubmissionError) {
      if (error.code === 'VALIDATION') {
        return secureJson({ success: false, error: error.message }, 400);
      }
      if (error.code === 'UNAVAILABLE') {
        return secureJson({ success: false, error: UNAVAILABLE }, 404);
      }
    }
    console.error('[wholesale-document] unexpected error:', error);
    return secureJson({ success: false, error: UNAVAILABLE }, 500);
  }
}
