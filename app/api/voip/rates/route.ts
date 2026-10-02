import { NextRequest } from 'next/server';
import { withVoipAuth } from '../_utils';
import { getRateCardWithRates } from '@/lib/voip/services/customer-rates';
import { toCustomerRateCardDto, toCustomerRateDto } from '@/lib/voip/dto/customer';

/**
 * GET /api/voip/rates — the customer's assigned selling rates.
 *
 * Customer-safe by construction: only destination/prefix/selling price and
 * billing parameters are returned. Wholesale cost, carrier identity, margin
 * and routing internals are never part of this response.
 */
export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'rates',
    handler: async (ctx) => {
      const organizationId = ctx.organization!.id;
      const { searchParams } = new URL(request.url);
      const query = (searchParams.get('q') || '').trim().toLowerCase();

      const card = await getRateCardWithRates(organizationId);
      const active = card && card.status === 'ACTIVE' ? card : null;
      if (!active) {
        return { card: null, rates: [] };
      }

      let rates = active.rates;
      if (query) {
        const digits = query.replace(/[^\d]/g, '');
        rates = rates.filter(
          (r) =>
            r.prefix.includes(digits || '') ||
            (r.destination || '').toLowerCase().includes(query) ||
            (r.country || '').toLowerCase() === query
        );
      }

      return {
        card: toCustomerRateCardDto(active),
        rates: rates.map(toCustomerRateDto),
      };
    },
  });
}
