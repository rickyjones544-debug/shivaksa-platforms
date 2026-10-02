import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../_utils';
import { getSipAccounts, getSipAccount, createSipAccount } from '@/lib/voip/services/sip';
import { toAdminSipAccountDto } from '@/lib/voip/dto/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'read',
    resource: 'sip',
    handler: async () => {
      const accounts = await getSipAccounts(id);
      return accounts.map(toAdminSipAccountDto);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
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
      // Returns the account DTO plus the generated password, shown once.
      const result = await createSipAccount(ctx, id, body);
      const account = await getSipAccount(id, result.id);
      return { ...(account ? toAdminSipAccountDto(account) : result), password: result.password };
    },
  });
}
