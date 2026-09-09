import { NextRequest } from 'next/server';
import { withVoipAuth } from '../_utils';
import { getOrCreateWallet } from '@/lib/voip/services/wallet';
import { toCustomerWalletDto } from '@/lib/voip/dto/customer';

export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'wallet',
    action: 'read',
    handler: async (ctx) => {
      const wallet = await getOrCreateWallet(ctx.organization!.id);
      return toCustomerWalletDto(wallet);
    },
  });
}
