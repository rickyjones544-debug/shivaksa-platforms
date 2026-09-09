import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import { issueRefund } from '@/lib/voip/services/wallet';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'wallet',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<{ amount: string | number; description?: string; reference?: string }>(request);
      const result = await issueRefund(
        ctx,
        id,
        body.amount,
        body.description || 'Admin refund',
        ctx.user.id,
        body.reference
      );
      return {
        transactionId: result.transaction.id,
        balance: result.wallet.balance.toString(),
      };
    },
  });
}
