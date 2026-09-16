import { NextRequest, NextResponse } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import { addCredit } from '@/lib/voip/services/wallet';
import { checkRateLimit } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (!checkRateLimit(request, 'wallet-credit', 10, 60 * 1000)) {
    return NextResponse.json(
      { success: false, error: 'Too many credit attempts. Please try again later.' },
      { status: 429 }
    );
  }

  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    scope: 'wallet',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<{
        amount: string | number;
        description?: string;
        idempotencyKey?: string;
      }>(request);
      const result = await addCredit(
        ctx,
        id,
        body.amount,
        body.description || 'Admin credit',
        ctx.user.id,
        body.idempotencyKey
      );
      return {
        transactionId: result.transaction.id,
        balance: result.wallet.balance.toString(),
      };
    },
  });
}
