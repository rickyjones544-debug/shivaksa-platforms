import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../_utils';
import {
  createRoutePolicy,
  listRoutePolicies,
  type CreateRoutePolicyInput,
} from '@/lib/voip/services/route-policies';

export async function GET(request: NextRequest) {
  return withVoipAdminAuth(request, {
    scope: 'carrier-route',
    action: 'read',
    handler: async (ctx) => {
      const value = new URL(request.url).searchParams.get('organizationId');
      const organizationId = value === 'global' ? null : (value ?? undefined);
      return listRoutePolicies(ctx, { organizationId });
    },
  });
}

export async function POST(request: NextRequest) {
  return withVoipAdminAuth(request, {
    scope: 'carrier-route',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<CreateRoutePolicyInput>(request);
      return createRoutePolicy(ctx, body);
    },
  });
}
