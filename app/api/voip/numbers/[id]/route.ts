import { NextRequest } from 'next/server';
import { withVoipAuth, readBody } from '../../_utils';
import { getPhoneNumber, updatePhoneNumber } from '@/lib/voip/services/numbers';
import { toCustomerPhoneNumberDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'numbers',
    handler: async (ctx) => {
      const phoneNumber = await getPhoneNumber(ctx.organization!.id, id);
      if (!phoneNumber) throw new Error('Not found');
      return toCustomerPhoneNumberDto(phoneNumber);
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'numbers',
    handler: async (ctx) => {
      const body = await readBody<{
        displayNumber?: string;
        status?: 'ACTIVE' | 'INACTIVE';
        sipAccountId?: string | null;
      }>(request);
      const phoneNumber = await updatePhoneNumber(ctx, ctx.organization!.id, id, body);
      return toCustomerPhoneNumberDto(phoneNumber);
    },
  });
}
