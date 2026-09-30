import { NextRequest } from 'next/server';
import { withVoipAdminAuth } from '../../voip/_utils';
import { listProviderSubmissions } from '@/lib/wholesale-profile/services/submission';

export async function GET(request: NextRequest) {
  const status = new URL(request.url).searchParams.get('status') ?? undefined;
  return withVoipAdminAuth(request, {
    scope: 'provider',
    action: 'read',
    resource: 'submissions',
    handler: (ctx) => listProviderSubmissions(ctx, { status }),
  });
}
