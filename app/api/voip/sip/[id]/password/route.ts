import { NextRequest } from 'next/server';
import { withVoipAuth } from '../../../_utils';
import { revealSipPassword } from '@/lib/voip/services/sip';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Deliberate, authenticated, audited reveal of the current SIP password.
 * Requires the write-level SIP permission (credential management), not just
 * read access. The password is never included in any list/read DTO.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      return revealSipPassword(ctx, ctx.organization!.id, id);
    },
  });
}
