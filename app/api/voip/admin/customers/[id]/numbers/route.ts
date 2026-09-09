import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../_utils';
import { getPhoneNumbers, createPhoneNumber } from '@/lib/voip/services/numbers';
import { toCustomerPhoneNumberDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'numbers',
    handler: async () => {
      const numbers = await getPhoneNumbers(id);
      return numbers.map(toCustomerPhoneNumberDto);
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'numbers',
    handler: async (ctx) => {
      const body = await readBody<{
        number: string;
        displayNumber?: string;
        providerNumberId?: string;
        sipAccountId?: string;
        provider?: string;
      }>(request);
      const phoneNumber = await createPhoneNumber(ctx, id, body);
      return toCustomerPhoneNumberDto(phoneNumber);
    },
  });
}
