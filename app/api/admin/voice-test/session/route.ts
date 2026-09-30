import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/auth';
import { withAdminAuth } from '../../_utils';
import { checkRateLimit } from '@/lib/rate-limit';

const SESSION_TTL_MS = 5 * 60 * 1000; // browser test session validity: 5 minutes

interface VoiceTestConfig {
  wssUrl: string;
  uri: string;
  username: string;
  password: string;
  displayName: string;
  expiresAt: string;
}

function loadConfig(): VoiceTestConfig | null {
  const wssUrl = process.env.WEBRTC_TEST_WSS_URL;
  const uri = process.env.WEBRTC_TEST_SIP_URI;
  const username = process.env.WEBRTC_TEST_SIP_USERNAME;
  const password = process.env.WEBRTC_TEST_SIP_PASSWORD;

  if (!wssUrl || !uri || !username || !password) {
    return null;
  }

  return {
    wssUrl,
    uri,
    username,
    password,
    displayName: 'Shivaksa Voice Test',
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.user.isSuperAdmin !== true) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  if (!checkRateLimit(request, 'voice-test-session', 10, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  // Authorization gate through the shared admin wrapper (401/403/500 pass through).
  const authorized = await withAdminAuth(request, {
    scope: 'voip',
    action: 'manage',
    handler: async () => null,
  });
  if (!authorized.ok) {
    return authorized;
  }

  const config = loadConfig();
  if (!config) {
    return NextResponse.json(
      { success: false, error: 'Voice test is not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, ...config });
}
