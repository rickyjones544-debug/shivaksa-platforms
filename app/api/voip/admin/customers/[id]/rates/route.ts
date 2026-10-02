import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../_utils';
import {
  createRateCard,
  updateRateCard,
  getRateCardWithRates,
  CustomerRateError,
} from '@/lib/voip/services/customer-rates';
import { toAdminRateCardDto, toAdminCustomerRateDto } from '@/lib/voip/dto/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Platform-only customer rate-card management. CLIENT_ADMIN can never reach
 * this (platformOnly); the customer sees only their selling rates via
 * /api/voip/rates.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'read',
    resource: 'rates',
    handler: async () => {
      const card = await getRateCardWithRates(id);
      if (!card) return { card: null, rates: [] };
      return {
        card: toAdminRateCardDto(card),
        rates: card.rates.map(toAdminCustomerRateDto),
      };
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'manage',
    handler: async (ctx) => {
      const body = await readBody<{ name?: string; description?: string; currency?: string }>(request);
      const card = await createRateCard(ctx, id, {
        name: body.name || '',
        description: body.description,
        currency: body.currency,
      });
      return toAdminRateCardDto(card);
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    targetOrganizationId: id,
    platformOnly: true,
    scope: 'voip',
    action: 'manage',
    handler: async (ctx) => {
      const body = await readBody<{
        cardId?: string;
        name?: string;
        description?: string | null;
        status?: string;
      }>(request);
      if (!body.cardId) throw new CustomerRateError('cardId is required');
      const card = await updateRateCard(ctx, id, body.cardId, body);
      return toAdminRateCardDto(card);
    },
  });
}
