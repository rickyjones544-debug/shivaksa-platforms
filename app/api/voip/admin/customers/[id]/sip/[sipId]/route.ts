import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import { getSipAccount, updateSipAccount, resetSipPassword } from '@/lib/voip/services/sip';
import { toCustomerSipAccountDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string; sipId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id, sipId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'sip',
    handler: async () => {
      const account = await getSipAccount(id, sipId);
      if (!account) throw new Error('Not found');
      return toCustomerSipAccountDto(account);
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, sipId } = await params;
  return withVoipAdminAuth(request, {
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
      return toCustomerSipAccountDto(account);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, sipId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      const account = await resetSipPassword(ctx, id, sipId);
      return toCustomerSipAccountDto(account);
    },
  });
}
