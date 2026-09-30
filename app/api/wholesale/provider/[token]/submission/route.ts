import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { submitProviderIntake, SubmissionError } from '@/lib/wholesale-profile/services/submission';

const MAX_BODY_BYTES = 512 * 1024; // intake JSON — documents are declarations only
const SUBMIT_RATE_LIMIT = 10;
const SUBMIT_RATE_WINDOW_MS = 10 * 60 * 1000;

const UNAVAILABLE = 'This wholesale partnership link is no longer accepting submissions.';

function secureJson(body: unknown, status: number): NextResponse {
  const res = NextResponse.json(body, { status });
  res.headers.set('Cache-Control', 'no-store, private');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res;
}

// Bearer-token submission endpoint. The token is the ONLY scope input; the
// server derives organization and link ownership from it.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Brute-force/abuse cap per client.
  if (!checkRateLimit(request, 'wholesale-submission', SUBMIT_RATE_LIMIT, SUBMIT_RATE_WINDOW_MS)) {
    return secureJson({ success: false, error: UNAVAILABLE }, 429);
  }

  // Same-origin enforcement: when a browser sends Origin, it must match the
  // request host. Requests without Origin (non-browser clients) still require
  // a valid token.
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

  // Hard body-size cap before parsing.
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return secureJson({ success: false, error: UNAVAILABLE }, 413);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return secureJson({ success: false, error: UNAVAILABLE }, 413);
    }
    body = JSON.parse(text);
  } catch {
    return secureJson({ success: false, error: 'Invalid request body' }, 400);
  }

  // Honeypot: legitimate browsers render this hidden field empty. A filled
  // value indicates a bot — acknowledge without processing.
  if (typeof body === 'object' && body !== null) {
    const hp = (body as Record<string, unknown>).hp;
    if (typeof hp === 'string' && hp.length > 0) {
      return secureJson({ success: true }, 200);
    }
    if (hp !== undefined && hp !== '') {
      return secureJson({ success: false, error: 'Invalid request body' }, 400);
    }
    delete (body as Record<string, unknown>).hp;
  }

  const { token } = await params;

  try {
    const result = await submitProviderIntake(token, body);
    return secureJson({ success: true, data: result }, 200);
  } catch (error) {
    if (error instanceof SubmissionError) {
      if (error.code === 'VALIDATION') {
        return secureJson(
          { success: false, error: 'Please correct the highlighted fields.', details: error.details ?? [] },
          400
        );
      }
      if (error.code === 'UNAVAILABLE') {
        return secureJson({ success: false, error: UNAVAILABLE }, 404);
      }
    }
    console.error('[wholesale-submission] unexpected error:', error);
    return secureJson({ success: false, error: UNAVAILABLE }, 500);
  }
}
