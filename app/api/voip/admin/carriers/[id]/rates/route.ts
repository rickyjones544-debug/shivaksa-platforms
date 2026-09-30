import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../_utils';
import {
  listCarrierRates,
  createCarrierRate,
  type CreateCarrierRateInput,
} from '@/lib/voip/services/carriers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-rate',
    action: 'read',
    handler: async (ctx) => listCarrierRates(ctx, id),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-rate',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<CreateCarrierRateInput>(request);
      return createCarrierRate(ctx, id, body);
    },
  });
}
