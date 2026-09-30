import { NextRequest } from 'next/server';
import { withVoipAdminAuth, readBody } from '../../../../_utils';
import {
  createCarrierCredential,
  type CreateCarrierCredentialInput,
} from '@/lib/voip/services/carriers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAdminAuth(request, {
    scope: 'carrier',
    action: 'write',
    handler: async (ctx) => {
      const body = await readBody<CreateCarrierCredentialInput>(request);
      return createCarrierCredential(ctx, id, body);
    },
  });
}
