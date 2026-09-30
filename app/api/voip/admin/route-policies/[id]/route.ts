import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../_utils';
import {
  disableRoutePolicy,
  getRoutePolicy,
  updateRoutePolicy,
  type UpdateRoutePolicyInput,
} from '@/lib/voip/services/route-policies';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-route',
    action: 'read',
    handler: async (ctx) => {
      const policy = await getRoutePolicy(ctx, id);
      if (!policy) throw new Error('Not found');
      return policy;
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-route',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<UpdateRoutePolicyInput>(request);
      return updateRoutePolicy(ctx, id, body);
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier-route',
    action: 'write',
    handler: async (ctx) => disableRoutePolicy(ctx, id),
  });
}
