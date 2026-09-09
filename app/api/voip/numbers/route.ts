import { NextRequest } from 'next/server';
import { withVoipAuth, readBody } from '../_utils';
import { getPhoneNumbers, createPhoneNumber } from '@/lib/voip/services/numbers';
import { toCustomerPhoneNumberDto } from '@/lib/voip/dto/customer';

export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'numbers',
    handler: async (ctx) => {
      const numbers = await getPhoneNumbers(ctx.organization!.id);
      return numbers.map(toCustomerPhoneNumberDto);
    },
  });
}

export async function POST(request: NextRequest) {
  return withVoipAuth(request, {
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
      const phoneNumber = await createPhoneNumber(ctx, ctx.organization!.id, body);
      return toCustomerPhoneNumberDto(phoneNumber);
    },
  });
}
