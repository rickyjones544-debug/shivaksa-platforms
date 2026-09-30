-- Provider submission documents (Phase 3C document handling).
-- Additive only: two new enums, one new table, new indexes and foreign keys.
-- No existing table is altered; no existing data is touched.

-- CreateEnum
CREATE TYPE "ProviderDocumentCategory" AS ENUM ('COMPANY_DOCUMENT', 'LICENSE', 'RATE_CARD', 'AGREEMENT', 'TECHNICAL_DOCUMENT', 'COMPLIANCE_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProviderSubmissionDocumentStatus" AS ENUM ('PENDING', 'ATTACHED');

-- CreateTable
CREATE TABLE "provider_submission_documents" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "onboarding_link_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "category" "ProviderDocumentCategory" NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "stored_object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "description" TEXT,
    "status" "ProviderSubmissionDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "scan_status" TEXT NOT NULL DEFAULT 'NOT_SCANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_submission_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_submission_documents_organization_id_idx" ON "provider_submission_documents"("organization_id");

-- CreateIndex
CREATE INDEX "provider_submission_documents_onboarding_link_id_idx" ON "provider_submission_documents"("onboarding_link_id");

-- CreateIndex
CREATE INDEX "provider_submission_documents_submission_id_idx" ON "provider_submission_documents"("submission_id");

-- CreateIndex
CREATE INDEX "provider_submission_documents_status_idx" ON "provider_submission_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "provider_submission_documents_stored_object_key_key" ON "provider_submission_documents"("stored_object_key");

-- AddForeignKey
ALTER TABLE "provider_submission_documents" ADD CONSTRAINT "provider_submission_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_submission_documents" ADD CONSTRAINT "provider_submission_documents_onboarding_link_id_fkey" FOREIGN KEY ("onboarding_link_id") REFERENCES "onboarding_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_submission_documents" ADD CONSTRAINT "provider_submission_documents_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "provider_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
