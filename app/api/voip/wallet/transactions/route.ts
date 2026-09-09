import { NextRequest } from 'next/server';
import { withVoipAuth } from '../../_utils';
import { getTransactions } from '@/lib/voip/services/wallet';
import { toCustomerTransactionDto } from '@/lib/voip/dto/customer';

export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'wallet',
    action: 'read',
    handler: async (ctx) => {
      const { searchParams } = new URL(request.url);
      const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 100);
      const skip = parseInt(searchParams.get('skip') || '0', 10);
      const transactions = await getTransactions(ctx.organization!.id, take, skip);
      return transactions.map(toCustomerTransactionDto);
    },
  });
}
