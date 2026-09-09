import { NextRequest } from 'next/server';
import { withVoipAuth, readBody } from '../_utils';
import { getSipAccounts, createSipAccount } from '@/lib/voip/services/sip';
import { toCustomerSipAccountDto } from '@/lib/voip/dto/customer';

export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'sip',
    handler: async (ctx) => {
      const accounts = await getSipAccounts(ctx.organization!.id);
      return accounts.map(toCustomerSipAccountDto);
    },
  });
}

export async function POST(request: NextRequest) {
  return withVoipAuth(request, {
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
      const account = await createSipAccount(ctx, ctx.organization!.id, body);
      return toCustomerSipAccountDto(account);
    },
  });
}
