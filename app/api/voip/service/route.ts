import { NextRequest, NextResponse } from 'next/server';
import { withVoipAuth, readBody } from '../_utils';
import { getOrCreateVoipService } from '@/lib/voip/services/customers';
import { toCustomerServiceDto } from '@/lib/voip/dto/customer';

// Fields a customer may self-edit. Pricing and billing parameters
// (customerRate, billingIncrementSeconds, minimumBillableSeconds,
// reserveMinutes, maxCallDurationMinutes) are platform-admin only and are
// rejected before the request reaches the service layer.
const CUSTOMER_EDITABLE_FIELDS = ['lowBalanceThresholds'] as const;

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
  const body = await readBody<Record<string, unknown>>(request).catch(
    () => ({}) as Record<string, unknown>
  );
  const rejected = Object.keys(body).filter(
    (key) => !(CUSTOMER_EDITABLE_FIELDS as readonly string[]).includes(key)
  );
  if (rejected.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Fields not editable through this endpoint: ${rejected.join(', ')}`,
      },
      { status: 403 }
    );
  }

  return withVoipAuth(request, {
    scope: 'voip',
    action: 'write',
    resource: 'sip',
    handler: async (ctx) => {
      const thresholds = body.lowBalanceThresholds;
      if (
        thresholds !== undefined &&
        (!Array.isArray(thresholds) ||
          !thresholds.every((t) => Number.isInteger(t) && t >= 0 && t <= 10080))
      ) {
        throw new Error('lowBalanceThresholds must be an array of non-negative integers (minutes)');
      }
      const { getOrCreateVoipService, updateVoipService } = await import('@/lib/voip/services/customers');
      await getOrCreateVoipService(ctx.organization!.id);
      const updated = await updateVoipService(ctx, ctx.organization!.id, {
        lowBalanceThresholds: thresholds as number[] | undefined,
      });
      return toCustomerServiceDto(updated);
    },
  });
}
