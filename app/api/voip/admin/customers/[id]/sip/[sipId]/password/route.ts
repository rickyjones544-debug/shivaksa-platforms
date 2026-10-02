import { NextRequest } from 'next/server';
import { withVoipAdminAuth } from '../../../../../../_utils';
import { revealSipPassword } from '@/lib/voip/services/sip';

interface RouteParams {
  params: Promise<{ id: string; sipId: string }>;
}

/**
 * Deliberate, audited reveal of a customer SIP password by a platform
 * operator. Never included in list/read DTOs.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id, sipId } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    platformOnly: true,
    handler: async (ctx) => {
      return revealSipPassword(ctx, id, sipId);
    },
  });
}
