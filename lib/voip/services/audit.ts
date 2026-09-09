import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

export type AuditAction =
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_SUSPENDED'
  | 'CUSTOMER_REACTIVATED'
  | 'SIP_ACCOUNT_CREATED'
  | 'SIP_ACCOUNT_UPDATED'
  | 'SIP_ACCOUNT_DISABLED'
  | 'SIP_CREDENTIAL_RESET'
  | 'PHONE_NUMBER_CREATED'
  | 'PHONE_NUMBER_UPDATED'
  | 'PHONE_NUMBER_ASSIGNED'
  | 'CREDIT_ADDED'
  | 'DEBIT_APPLIED'
  | 'REFUND_ISSUED'
  | 'BALANCE_ADJUSTED'
  | 'RATE_CHANGED'
  | 'RESERVE_CHANGED'
  | 'PROVIDER_CONFIGURATION_CHANGED'
  | 'CALL_INITIATED'
  | 'CALL_COMPLETED'
  | 'CALL_FAILED'
  | 'CALL_HANGUP'
  | 'NOTIFICATION_SENT'
  | 'WEBHOOK_PROCESSED'
  | 'WEBHOOK_DUPLICATE'
  | 'SERVICE_STATUS_CHANGED';

export async function audit(
  ctx: AuthenticatedContext | null,
  action: AuditAction,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: ctx?.user.id,
        organizationId: ctx?.organization?.id,
        action,
        resource,
        resourceId,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('[audit] Failed to write audit log:', error);
  }
}

export async function auditSystem(
  action: AuditAction,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  return audit(null, action, resource, resourceId, metadata);
}
