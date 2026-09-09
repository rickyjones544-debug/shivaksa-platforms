import { NextRequest } from 'next/server';
import { withVoipAuth, readBody } from '../_utils';
import { getOrCreateVoipService } from '@/lib/voip/services/customers';
import { toCustomerServiceDto } from '@/lib/voip/dto/customer';

export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'sip',
    handler: async (ctx) => {
      const service = await getOrCreateVoipService(ctx.organization!.id);
      return toCustomerServiceDto(service);
    },
  });
}

export async function PATCH(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      const body = await readBody<{
        customerRate?: string | number;
        reserveMinutes?: number;
        maxCallDurationMinutes?: number;
      }>(request);
      const { getOrCreateVoipService, updateVoipService } = await import('@/lib/voip/services/customers');
      await getOrCreateVoipService(ctx.organization!.id);
      const updated = await updateVoipService(ctx, ctx.organization!.id, body);
      return toCustomerServiceDto(updated);
    },
  });
}
