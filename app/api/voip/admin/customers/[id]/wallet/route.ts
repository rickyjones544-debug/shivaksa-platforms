import { NextRequest } from 'next/server';
import { withVoipAdminAuth } from '../../../../_utils';
import { getOrCreateWallet, getTransactions } from '@/lib/voip/services/wallet';
import { toCustomerTransactionDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'wallet',
    action: 'read',
    handler: async () => {
      const { searchParams } = new URL(request.url);
      const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 100);
      const skip = parseInt(searchParams.get('skip') || '0', 10);
      const wallet = await getOrCreateWallet(id);
      const transactions = await getTransactions(id, take, skip);
      return {
        balance: wallet.balance.toString(),
        reserved: wallet.reserved.toString(),
        available: wallet.balance.minus(wallet.reserved).toString(),
        transactions: transactions.map(toCustomerTransactionDto),
      };
    },
  });
}
