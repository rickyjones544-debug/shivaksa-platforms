import { prisma } from '@/lib/db/prisma';
import { NotificationType } from '@/lib/voip/constants';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { audit } from './audit';

interface NotificationInput {
  organizationId: string;
  userId?: string;
  type: keyof typeof NotificationType;
  thresholdMinutes?: number;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function recordNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      thresholdMinutes: input.thresholdMinutes,
      message: input.message,
    },
  });
}

export async function shouldSendBalanceNotification(
  organizationId: string,
  type: keyof typeof NotificationType,
  thresholdMinutes?: number
): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.notification.findFirst({
    where: {
      organizationId,
      type,
      thresholdMinutes,
      sentAt: { gte: oneDayAgo },
    },
  });
  return !existing;
}

export async function sendBalanceNotification(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  type: keyof typeof NotificationType,
  message: string,
  thresholdMinutes?: number
) {
  const shouldSend = await shouldSendBalanceNotification(organizationId, type, thresholdMinutes);
  if (!shouldSend) {
    return null;
  }

  const notification = await recordNotification({
    organizationId,
    type,
    thresholdMinutes,
    message,
  });

  // Email delivery is handled by the platform email service when configured.
  // For now, the notification is recorded and can be displayed in the portal.
  console.log(`[notification] ${type} for organization ${organizationId}: ${message}`);

  await audit(ctx, 'NOTIFICATION_SENT', 'Notification', notification.id, {
    type,
    thresholdMinutes,
  });

  return notification;
}
