import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../../_utils';
import {
  getCarrierRate,
  updateCarrierRate,
  disableCarrierRate,
  type UpdateCarrierRateInput,
} from '@/lib/voip/services/carriers';

interface RouteParams {
  params: Promise<{ id: string; rateId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: _carrierId, rateId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-rate',
    action: 'read',
    handler: async (ctx) => {
      const rate = await getCarrierRate(ctx, rateId);
      if (!rate) throw new Error('Not found');
      return rate;
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: _carrierId, rateId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-rate',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<UpdateCarrierRateInput>(request);
      return updateCarrierRate(ctx, rateId, body);
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: _carrierId, rateId } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-rate',
    action: 'delete',
    handler: async (ctx) => disableCarrierRate(ctx, rateId),
  });
}
