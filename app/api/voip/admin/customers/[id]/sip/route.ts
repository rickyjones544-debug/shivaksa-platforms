import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../_utils';
import { getSipAccounts, createSipAccount } from '@/lib/voip/services/sip';
import { toCustomerSipAccountDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'sip',
    handler: async () => {
      const accounts = await getSipAccounts(id);
      return accounts.map(toCustomerSipAccountDto);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      const body = await readBody<{
        username?: string;
        domain?: string;
        callerId?: string;
        maxConcurrentCalls?: number;
      }>(request);
      const account = await createSipAccount(ctx, id, body);
      return toCustomerSipAccountDto(account);
    },
  });
}
