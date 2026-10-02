import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import { getSipAccount, updateSipAccount, resetSipPassword } from '@/lib/voip/services/sip';
import { toAdminSipAccountDto } from '@/lib/voip/dto/admin';

interface RouteParams {
  params: Promise<{ id: string; sipId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id, sipId } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'read',
    resource: 'sip',
    handler: async () => {
      const account = await getSipAccount(id, sipId);
      if (!account) throw new Error('Not found');
      return toAdminSipAccountDto(account);
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, sipId } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      const body = await readBody<{
        status?: 'ACTIVE' | 'DISABLED';
        callerId?: string;
        maxConcurrentCalls?: number;
        domain?: string;
      }>(request);
      const account = await updateSipAccount(ctx, id, sipId, body);
      return toAdminSipAccountDto(account);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, sipId } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      // Returns the account DTO plus the newly generated password once.
      const result = await resetSipPassword(ctx, id, sipId);
      const account = await getSipAccount(id, sipId);
      return {
        ...(account ? toAdminSipAccountDto(account) : result),
        password: result.password,
        notice: result.notice,
      };
    },
  });
}
