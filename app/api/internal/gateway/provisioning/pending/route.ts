import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedGatewayRequest, gatewayUnauthorized } from '@/lib/voip/gateway-auth';
import { prisma } from '@/lib/db/prisma';
import { ProvisioningTaskStatuses } from '@/lib/voip/services/provisioning';

/**
 * The gateway agent polls this endpoint for pending provisioning tasks.
 * Claiming is atomic per task: a row claimed here is marked PROCESSING and
 * increments `attempts`, so a crashed agent never double-applies a task —
 * and exhausted tasks are surfaced as FAILED rather than looping forever.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedGatewayRequest(request)) {
    return gatewayUnauthorized();
  }

  const limit = Math.min(
    Math.max(parseInt(new URL(request.url).searchParams.get('limit') || '20', 10) || 20, 1),
    100
  );

  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);

  // Reclaim tasks stuck in PROCESSING for >5min (agent crashed mid-apply).
  await prisma.provisioningTask.updateMany({
    where: {
      status: ProvisioningTaskStatuses.PROCESSING,
      updatedAt: { lt: staleBefore },
    },
    data: { status: ProvisioningTaskStatuses.PENDING },
  });

  const pending = await prisma.provisioningTask.findMany({
    where: { status: ProvisioningTaskStatuses.PENDING },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, action: true, sipAccountId: true, callId: true, payload: true },
  });

  for (const task of pending) {
    await prisma.provisioningTask.update({
      where: { id: task.id },
      data: {
        status: ProvisioningTaskStatuses.PROCESSING,
        attempts: { increment: 1 },
      },
    });
  }

  return NextResponse.json({ success: true, data: { tasks: pending } });
}
