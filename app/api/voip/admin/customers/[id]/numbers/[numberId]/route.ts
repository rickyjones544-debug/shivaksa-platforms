import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import { getPhoneNumber, updatePhoneNumber, assignPhoneNumberToSipAccount } from '@/lib/voip/services/numbers';
import { toCustomerPhoneNumberDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string; numberId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id, numberId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'numbers',
    handler: async () => {
      const phoneNumber = await getPhoneNumber(id, numberId);
      if (!phoneNumber) throw new Error('Not found');
      return toCustomerPhoneNumberDto(phoneNumber);
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, numberId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'numbers',
    handler: async (ctx) => {
      const body = await readBody<{
        displayNumber?: string;
        status?: 'ACTIVE' | 'INACTIVE';
        sipAccountId?: string | null;
      }>(request);
      const phoneNumber = await updatePhoneNumber(ctx, id, numberId, body);
      return toCustomerPhoneNumberDto(phoneNumber);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id, numberId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'numbers',
    handler: async (ctx) => {
      const body = await readBody<{ sipAccountId: string }>(request);
      const phoneNumber = await assignPhoneNumberToSipAccount(ctx, id, numberId, body.sipAccountId);
      return toCustomerPhoneNumberDto(phoneNumber);
    },
  });
}
