import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../../_utils';
import { updateRate, type RateInput } from '@/lib/voip/services/customer-rates';
import { toAdminCustomerRateDto } from '@/lib/voip/dto/admin';

interface RouteParams {
  params: Promise<{ id: string; rateId: string }>;
}

/** PATCH — edit or disable a selling-rate entry (platform operators only). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, rateId } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'manage',
    handler: async (ctx) => {
      const body = await readBody<Partial<RateInput>>(request);
      const rate = await updateRate(ctx, id, rateId, body);
      return toAdminCustomerRateDto(rate);
    },
  });
}
