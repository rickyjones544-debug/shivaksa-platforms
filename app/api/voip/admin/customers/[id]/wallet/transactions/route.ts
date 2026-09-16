import { NextRequest } from 'next/server';
import { withVoipAdminAuth } from '../../../../../_utils';
import { getTransactions } from '@/lib/voip/services/wallet';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const take = Math.min(parseInt(searchParams.get('take') || '100', 10), 250);
  const skip = parseInt(searchParams.get('skip') || '0', 10);

  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    scope: 'wallet',
    action: 'read',
    handler: async () => {
      const transactions = await getTransactions(id, take, skip);
      return transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        balanceAfter: tx.balanceAfter.toString(),
        description: tx.description,
        reference: tx.reference,
        createdAt: tx.createdAt,
      }));
    },
  });
}
