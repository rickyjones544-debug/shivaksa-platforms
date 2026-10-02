import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import {
  addRate,
  CustomerRateError,
  type RateInput,
} from '@/lib/voip/services/customer-rates';
import { toAdminCustomerRateDto } from '@/lib/voip/dto/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST — add a selling-rate entry to the customer's rate card. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'manage',
    handler: async (ctx) => {
      const body = await readBody<RateInput & { cardId?: string }>(request);
      if (!body.cardId) throw new CustomerRateError('cardId is required');
      const rate = await addRate(ctx, id, body.cardId, body);
      return toAdminCustomerRateDto(rate);
    },
  });
}
