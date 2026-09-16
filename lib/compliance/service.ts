import { prisma } from '@/lib/db/prisma';
import { KycRecordStatus, type KycRecord, type KycDocument } from '@prisma/client';
import { hasPermission, belongsToOrganization } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { audit } from '@/lib/voip/services/audit';
import { recordNotification } from '@/lib/voip/services/notifications';
import { NotificationType } from '@/lib/voip/constants';
import { KycDocumentSource, KycDocumentStatus } from './constants';

export interface KycRecordInput {
  legalBusinessName?: string;
  businessType?: string;
  country?: string;
  stateProvince?: string;
  businessRegistrationInfo?: string;
  website?: string;
  businessDescription?: string;
  intendedUseCase?: string;
  expectedMonthlyVolume?: string;
  expectedDestinations?: string;
  callerIdInfo?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface KycDocumentInput {
  type: string;
  name: string;
  description?: string;
  contentType?: string;
  storageKey?: string;
}

function requiresReviewReason(status: KycRecordStatus): boolean {
  return (
    status === KycRecordStatus.REJECTED ||
    status === KycRecordStatus.MORE_INFORMATION_REQUIRED ||
    status === KycRecordStatus.SUSPENDED
  );
}

export function canEditKycRecord(ctx: AuthenticatedContext, organizationId: string, currentStatus: KycRecordStatus): boolean {
  if (!belongsToOrganization(ctx, organizationId)) return false;
  return currentStatus === KycRecordStatus.DRAFT || currentStatus === KycRecordStatus.MORE_INFORMATION_REQUIRED;
}

// Phase 2A: reviews are restricted to super admins until an explicit
// reviewer-scope model is added for non-super admin compliance officers.
export function canReviewKycRecord(ctx: AuthenticatedContext): boolean {
  return ctx.user.isSuperAdmin;
}

export async function getOrCreateKycRecord(organizationId: string): Promise<KycRecord> {
  const existing = await prisma.kycRecord.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.kycRecord.create({
    data: { organizationId, status: KycRecordStatus.DRAFT },
  });
}

export async function getKycRecord(organizationId: string): Promise<(KycRecord & { documents: KycDocument[] }) | null> {
  return prisma.kycRecord.findUnique({
    where: { organizationId },
    include: { documents: true },
  });
}

export async function getKycRecordById(id: string): Promise<KycRecord | null> {
  return prisma.kycRecord.findUnique({
    where: { id },
    include: { documents: true, reviewedBy: { select: { id: true, name: true, email: true } } },
  });
}

export interface KycRecordListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  status: KycRecordStatus;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
}

export async function getKycRecordsByStatus(status?: KycRecordStatus): Promise<KycRecordListItem[]> {
  const where = status ? { status } : {};
  const records = await prisma.kycRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { organization: { select: { id: true, name: true, slug: true } }, documents: true },
  });

  return records.map((record) => ({
    id: record.id,
    organizationId: record.organizationId,
    organizationName: record.organization?.name ?? record.organizationId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    documentCount: record.documents.length,
  }));
}

export async function updateKycRecord(ctx: AuthenticatedContext, input: KycRecordInput, documents?: KycDocumentInput[]) {
  const organizationId = ctx.organization?.id;
  if (!organizationId) throw new Error('No active organization');

  const record = await getOrCreateKycRecord(organizationId);
  if (!canEditKycRecord(ctx, organizationId, record.status)) {
    throw new Error('Cannot edit onboarding record in current status');
  }

  const updated = await prisma.kycRecord.update({
    where: { organizationId },
    data: input,
  });

  if (documents && documents.length > 0) {
    await prisma.kycDocument.createMany({
      data: documents.map((doc) => ({
        kycRecordId: updated.id,
        type: doc.type,
        name: doc.name,
        description: doc.description,
        contentType: doc.contentType,
        // Storage is not configured yet; any client-provided storage key is
        // ignored until a real storage provider is wired up.
        storageKey: null,
        source: KycDocumentSource.METADATA_ONLY,
        status: KycDocumentStatus.PENDING,
      })),
    });
  }

  await audit(ctx, 'KYC_RECORD_UPDATED', 'KycRecord', updated.id, { organizationId });
  return updated;
}

export async function submitKycRecord(ctx: AuthenticatedContext) {
  const organizationId = ctx.organization?.id;
  if (!organizationId) throw new Error('No active organization');

  const record = await getOrCreateKycRecord(organizationId);
  if (!canEditKycRecord(ctx, organizationId, record.status)) {
    throw new Error('Cannot submit onboarding record in current status');
  }

  const updated = await prisma.kycRecord.update({
    where: { organizationId },
    data: { status: KycRecordStatus.SUBMITTED },
  });

  await audit(ctx, 'KYC_RECORD_SUBMITTED', 'KycRecord', updated.id, { organizationId });
  await recordNotification({
    organizationId,
    type: 'KYC_SUBMITTED',
    message: 'Onboarding information has been submitted for review.',
  });

  return updated;
}

export async function reviewKycRecord(
  ctx: AuthenticatedContext,
  organizationId: string,
  status: KycRecordStatus,
  reason?: string
) {
  if (!canReviewKycRecord(ctx)) {
    throw new Error('Forbidden');
  }

  if (requiresReviewReason(status) && !reason) {
    throw new Error(`${status} requires a reason`);
  }

  const record = await prisma.kycRecord.findUnique({
    where: { organizationId },
    include: { organization: true },
  });

  if (!record) throw new Error('Not found');

  const data: {
    status: KycRecordStatus;
    reviewedById: string;
    reviewedAt: Date;
    rejectionReason?: string | null;
    moreInfoReason?: string | null;
  } = {
    status,
    reviewedById: ctx.user.id,
    reviewedAt: new Date(),
    rejectionReason: status === KycRecordStatus.REJECTED ? reason : null,
    moreInfoReason: status === KycRecordStatus.MORE_INFORMATION_REQUIRED ? reason : null,
  };

  const updated = await prisma.kycRecord.update({
    where: { organizationId },
    data,
  });

  const notificationMap: Record<KycRecordStatus, keyof typeof NotificationType> = {
    [KycRecordStatus.DRAFT]: 'KYC_SUBMITTED',
    [KycRecordStatus.SUBMITTED]: 'KYC_SUBMITTED',
    [KycRecordStatus.UNDER_REVIEW]: 'KYC_UNDER_REVIEW',
    [KycRecordStatus.MORE_INFORMATION_REQUIRED]: 'KYC_MORE_INFORMATION_REQUIRED',
    [KycRecordStatus.APPROVED]: 'KYC_APPROVED',
    [KycRecordStatus.REJECTED]: 'KYC_REJECTED',
    [KycRecordStatus.SUSPENDED]: 'KYC_SUSPENDED',
  };

  const notificationType = notificationMap[status];
  const message = reason
    ? `Onboarding status changed to ${status}. Reason: ${reason}`
    : `Onboarding status changed to ${status}.`;

  await recordNotification({
    organizationId,
    type: notificationType,
    message,
  });

  await audit(ctx, 'KYC_RECORD_REVIEWED', 'KycRecord', updated.id, {
    organizationId,
    previousStatus: record.status,
    newStatus: status,
    reason,
  });

  return updated;
}
