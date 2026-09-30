import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../_utils';
import {
  listCarriers,
  createCarrier,
  type CreateCarrierInput,
} from '@/lib/voip/services/carriers';

export async function GET(request: NextRequest) {
  return withVoipAdminAuth(request, {
    scope: 'carrier',
    action: 'read',
    handler: async (ctx) => listCarriers(ctx),
  });
}

export async function POST(request: NextRequest) {
  return withVoipAdminAuth(request, {
    scope: 'carrier',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<CreateCarrierInput>(request);
      const result = await createCarrier(ctx, body);
      return result.carrier;
    },
  });
}
