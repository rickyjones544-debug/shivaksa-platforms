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
  | 'CARRIER_CREATED'
  | 'CARRIER_UPDATED'
  | 'CARRIER_DISABLED'
  | 'CARRIER_CREDENTIAL_UPDATED'
  | 'CARRIER_RATE_CREATED'
  | 'CARRIER_RATE_UPDATED'
  | 'CARRIER_CLI_UPDATED'
  | 'CARRIER_ROUTE_POLICY_CREATED'
  | 'CARRIER_ROUTE_POLICY_UPDATED'
  | 'CALL_INITIATED'
  | 'CALL_COMPLETED'
  | 'CALL_FAILED'
  | 'CALL_HANGUP'
  | 'NOTIFICATION_SENT'
  | 'WEBHOOK_PROCESSED'
  | 'WEBHOOK_DUPLICATE'
  | 'SERVICE_STATUS_CHANGED'
  | 'KYC_RECORD_UPDATED'
  | 'KYC_RECORD_SUBMITTED'
  | 'KYC_RECORD_REVIEWED'
  | 'KYC_DOCUMENT_UPLOADED'
  | 'REQUIREMENT_SET_CREATED'
  | 'REQUIREMENT_SET_UPDATED'
  | 'REQUIREMENT_SECTION_UPDATED'
  | 'REQUIREMENT_VERSION_CREATED'
  | 'REQUIREMENT_VERSION_PUBLISHED'
  | 'REQUIREMENT_VERSION_ARCHIVED'
  | 'WHOLESALE_PROFILE_CREATED'
  | 'WHOLESALE_PROFILE_UPDATED'
  | 'WHOLESALE_PROFILE_PUBLISHED'
  | 'WHOLESALE_PROFILE_ARCHIVED'
  | 'ONBOARDING_LINK_CREATED'
  | 'ONBOARDING_LINK_VIEWED'
  | 'ONBOARDING_LINK_REVOKED'
  | 'PROVIDER_SUBMISSION_CREATED'
  | 'PROVIDER_SUBMISSION_VIEWED'
  | 'PROVIDER_SUBMISSION_STATUS_CHANGED'
  | 'PROVIDER_SUBMISSION_ACCEPTED'
  | 'PROVIDER_SUBMISSION_REJECTED'
  | 'PROVIDER_SUBMISSION_PROMOTED'
  | 'PROVIDER_SUBMISSION_DOCUMENT_UPLOADED'
  | 'PROVIDER_SUBMISSION_DOCUMENT_ACCESSED'
  | 'PROVIDER_SUBMISSION_DOCUMENT_REJECTED'
  | 'PROVIDER_RATE_SHEET_CREATED'
  | 'PROVIDER_RATE_SHEET_UPDATED'
  | 'PROVIDER_RATE_SHEET_ARCHIVED'
  | 'PROVIDER_RATE_SHEET_VERSION_CREATED'
  | 'PROVIDER_RATE_SHEET_VERSION_PUBLISHED'
  | 'PROVIDER_RATE_SHEET_VERSION_DELETED'
  | 'PROVIDER_RATE_SHEET_REVIEW_REQUESTED'
  | 'PROVIDER_RATE_SHEET_REVIEW_CANCELLED';

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
