import { NextRequest, NextResponse } from 'next/server';
import { withVoipAuth, readBody } from '../_utils';
import { initiateOutboundCall, listCalls } from '@/lib/voip/services/calls';
import { toCustomerCallDto } from '@/lib/voip/dto/customer';
import { InsufficientBalanceError } from '@/lib/voip/services/wallet';
import { CallAuthorizationError } from '@/lib/voip/services/call-authorization';

export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'calls',
    handler: async (ctx) => {
      const { searchParams } = new URL(request.url);
      const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 100);
      const skip = parseInt(searchParams.get('skip') || '0', 10);
      const calls = await listCalls(ctx.organization!.id, take, skip);
      return calls.map(toCustomerCallDto);
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    return await withVoipAuth(request, {
      scope: 'voip',
      action: 'write',
      resource: 'calls',
      handler: async (ctx) => {
        const body = await readBody<{ sipAccountId: string; destination: string }>(request);
        const result = await initiateOutboundCall(ctx, body);
        return {
          callId: result.callId,
          providerCallId: result.providerCallId,
          callerId: result.callerId,
          destination: result.destination,
          maxDurationMinutes: result.maxDurationMinutes,
        };
      },
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 402 });
    }
    if (error instanceof CallAuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    throw error;
  }
}
