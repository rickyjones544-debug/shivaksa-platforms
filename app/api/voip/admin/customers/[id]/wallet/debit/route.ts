import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import { addDebit } from '@/lib/voip/services/wallet';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'wallet',
    action: 'write',
    handler: async () => {
      const body = await readBody<{ amount: string | number; description?: string }>(request);
      const result = await addDebit(
        id,
        body.amount,
        body.description || 'Admin debit'
      );
      return {
        transactionId: result.transaction.id,
        balance: result.wallet.balance.toString(),
      };
    },
  });
}
