import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../_utils';
import {
  getCarrier,
  updateCarrier,
  disableCarrier,
  type UpdateCarrierInput,
} from '@/lib/voip/services/carriers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier',
    action: 'read',
    handler: async (ctx) => {
      const carrier = await getCarrier(ctx, id);
      if (!carrier) throw new Error('Not found');
      return carrier;
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<UpdateCarrierInput>(request);
      return updateCarrier(ctx, id, body);
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier',
    action: 'delete',
    handler: async (ctx) => disableCarrier(ctx, id),
  });
}
