import { NextRequest } from 'next/server';
import { withVoipAuth, readBody } from '../../_utils';
import { getSipAccount, updateSipAccount, resetSipPassword } from '@/lib/voip/services/sip';
import { toCustomerSipAccountDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'sip',
    handler: async (ctx) => {
      const account = await getSipAccount(ctx.organization!.id, id);
      if (!account) throw new Error('Not found');
      return toCustomerSipAccountDto(account);
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
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
      const account = await updateSipAccount(ctx, ctx.organization!.id, id, body);
      return toCustomerSipAccountDto(account);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      const account = await resetSipPassword(ctx, ctx.organization!.id, id);
      return toCustomerSipAccountDto(account);
    },
  });
}
