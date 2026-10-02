import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withVoipAuth } from '../_utils';
import { getActiveCallCount, getUsageForPeriod, currentPeriodStart } from '@/lib/voip/services/usage';
import { toCustomerUsageDto } from '@/lib/voip/dto/customer';
import { SipAccountStatus } from '@/lib/voip/constants';

/**
 * GET /api/voip/usage — current-period usage rollup + live concurrency.
 *
 * Usage totals come from `usage_aggregates` (written only by server-side
 * billing reconciliation). `activeCalls` is computed from authoritative call
 * state. `maxConcurrentCalls` is the sum of limits across the org's ACTIVE
 * SIP accounts.
 */
export async function GET(request: NextRequest) {
  return withVoipAuth(request, {
    scope: 'voip',
    action: 'read',
    resource: 'usage',
    handler: async (ctx) => {
      const organizationId = ctx.organization!.id;
      const period = currentPeriodStart();

      const [usage, activeCalls, accounts] = await Promise.all([
        getUsageForPeriod(organizationId, period),
        getActiveCallCount(organizationId),
        prisma.sipAccount.findMany({
          where: { organizationId, status: SipAccountStatus.ACTIVE },
          select: { maxConcurrentCalls: true },
        }),
      ]);

      const maxConcurrentCalls = accounts.reduce((sum, a) => sum + a.maxConcurrentCalls, 0);

      return {
        periodStart: period.toISOString(),
        usage: usage ? toCustomerUsageDto(usage) : null,
        activeCalls,
        maxConcurrentCalls,
      };
    },
  });
}
