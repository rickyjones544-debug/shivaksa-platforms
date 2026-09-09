import { NextRequest } from 'next/server';
import { withVoipAuth } from '../../_utils';
import { getCall, hangupCall } from '@/lib/voip/services/calls';
import { toCustomerCallDto } from '@/lib/voip/dto/customer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'calls',
    handler: async (ctx) => {
      const call = await getCall(ctx.organization!.id, id);
      if (!call) throw new Error('Not found');
      return toCustomerCallDto(call);
    },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'calls',
    handler: async (ctx) => {
      await hangupCall(ctx, ctx.organization!.id, id);
      return { success: true };
    },
  });
}
