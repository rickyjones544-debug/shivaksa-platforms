import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { audit } from '@/lib/voip/services/audit';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { putPrivateObject, getPrivateObject } from '@/lib/storage';
import { findOnboardingLinkByToken } from './onboarding-link';
import { getPublishedWholesaleProfile } from './profile';
import { SubmissionError } from './submission';
import {
  isAllowedDocumentCategory,
  validateDocumentUpload,
  sanitizeFileName,
  MAX_DOCUMENTS_PER_LINK,
  MAX_DESCRIPTION_LEN,
} from '../validation/documents';

const UNAVAILABLE = 'This wholesale partnership link is no longer accepting submissions.';

export interface ProviderDocumentUploadInput {
  category: string;
  fileName: unknown;
  mimeType: unknown;
  description?: unknown;
  buffer: Buffer;
}

export interface ProviderDocumentMetadata {
  id: string;
  category: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  description: string | null;
}

async function rejectAndAudit(
  link: { id: string; organizationId: string } | null,
  input: { category: unknown; fileName: unknown; mimeType: unknown; sizeBytes: number },
  reason: string,
  message: string
): Promise<never> {
  await audit(null, 'PROVIDER_SUBMISSION_DOCUMENT_REJECTED', 'provider_submission_document', undefined, {
    organizationId: link?.organizationId,
    onboardingLinkId: link?.id,
    category: typeof input.category === 'string' ? input.category : null,
    fileName: sanitizeFileName(input.fileName),
    mimeType: typeof input.mimeType === 'string' ? input.mimeType : null,
    sizeBytes: input.sizeBytes,
    reason,
  });
  throw new SubmissionError(message, 'VALIDATION', [message]);
}

// ============================================================================
// Provider-facing upload — bearer-token scoped. Documents are PENDING on the
// onboarding link and become part of the submission snapshot only when the
// intake is actually submitted.
// ============================================================================

export async function uploadProviderDocument(
  rawToken: string,
  input: ProviderDocumentUploadInput
): Promise<ProviderDocumentMetadata> {
  const link = await findOnboardingLinkByToken(rawToken);
  if (!link) throw new SubmissionError(UNAVAILABLE, 'UNAVAILABLE');

  const profile = await getPublishedWholesaleProfile(link.organizationId);
  if (!profile) throw new SubmissionError(UNAVAILABLE, 'UNAVAILABLE');

  if (link.maxSubmissions != null && link.submissionCount >= link.maxSubmissions) {
    throw new SubmissionError(UNAVAILABLE, 'UNAVAILABLE');
  }

  const category = typeof input.category === 'string' ? input.category : '';
  if (!isAllowedDocumentCategory(category)) {
    return rejectAndAudit(link, { ...input, sizeBytes: input.buffer.length }, 'BAD_CATEGORY', 'Invalid document category');
  }

  const existingCount = await prisma.providerSubmissionDocument.count({
    where: { onboardingLinkId: link.id },
  });
  if (existingCount >= MAX_DOCUMENTS_PER_LINK) {
    return rejectAndAudit(
      link,
      { ...input, sizeBytes: input.buffer.length },
      'TOO_MANY',
      'The maximum number of documents has been reached'
    );
  }

  const verdict = validateDocumentUpload({
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: input.buffer,
  });
  if (!verdict.ok) {
    return rejectAndAudit(link, { ...input, sizeBytes: input.buffer.length }, verdict.reason, verdict.message);
  }

  // Storage key: random, namespaced by onboarding link — never derived from
  // the provider's filename, token, email, or any caller-supplied segment.
  const storedObjectKey = `provider-submissions/${link.id}/${randomUUID()}.${verdict.ext}`;

  await putPrivateObject(storedObjectKey, input.buffer);

  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim().slice(0, MAX_DESCRIPTION_LEN)
      : null;

  const doc = await prisma.providerSubmissionDocument.create({
    data: {
      organizationId: link.organizationId,
      onboardingLinkId: link.id,
      submissionId: null,
      category,
      originalFileName: verdict.safeFileName,
      storedObjectKey,
      mimeType: input.mimeType as string,
      sizeBytes: input.buffer.length,
      description,
      status: 'PENDING',
      scanStatus: 'NOT_SCANNED',
    },
  });

  await audit(null, 'PROVIDER_SUBMISSION_DOCUMENT_UPLOADED', 'provider_submission_document', doc.id, {
    organizationId: link.organizationId,
    onboardingLinkId: link.id,
    category,
    fileName: verdict.safeFileName,
    sizeBytes: doc.sizeBytes,
    mimeType: doc.mimeType,
  });

  return {
    id: doc.id,
    category: doc.category,
    fileName: doc.originalFileName,
    sizeBytes: doc.sizeBytes,
    mimeType: doc.mimeType,
    description: doc.description,
  };
}

// ============================================================================
// Internal retrieval — authenticated, RBAC + organization + submission-scope
// checked before any object is read from private storage.
// ============================================================================

function resolveOrgId(ctx: AuthenticatedContext): string {
  const orgId = ctx.organization?.id ?? ctx.membership?.organizationId;
  if (!orgId) throw new SubmissionError('No organization context', 'FORBIDDEN');
  return orgId;
}

export async function getSubmissionDocument(
  ctx: AuthenticatedContext,
  submissionId: string,
  documentId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string; sizeBytes: number }> {
  if (!hasPermission(ctx, 'provider', 'read', 'submissions')) {
    throw new SubmissionError('Forbidden', 'FORBIDDEN');
  }
  const organizationId = resolveOrgId(ctx);

  const submission = await prisma.providerSubmission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.organizationId !== organizationId) {
    throw new SubmissionError('Not found', 'NOT_FOUND');
  }

  const doc = await prisma.providerSubmissionDocument.findUnique({ where: { id: documentId } });
  if (
    !doc ||
    doc.submissionId !== submission.id ||
    doc.organizationId !== organizationId ||
    doc.status !== 'ATTACHED'
  ) {
    throw new SubmissionError('Not found', 'NOT_FOUND');
  }

  const buffer = await getPrivateObject(doc.storedObjectKey);
  if (!buffer) {
    throw new SubmissionError('Not found', 'NOT_FOUND');
  }

  await audit(ctx, 'PROVIDER_SUBMISSION_DOCUMENT_ACCESSED', 'provider_submission_document', doc.id, {
    organizationId,
    submissionId: submission.id,
    category: doc.category,
    fileName: doc.originalFileName,
  });

  return { buffer, mimeType: doc.mimeType, fileName: doc.originalFileName, sizeBytes: doc.sizeBytes };
}
