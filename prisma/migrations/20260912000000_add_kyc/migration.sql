-- Create KYC/KYB onboarding tables

CREATE TYPE "KycRecordStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED');

CREATE TABLE "kyc_records" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "legal_business_name" TEXT,
    "business_type" TEXT,
    "country" TEXT,
    "state_province" TEXT,
    "business_registration_info" TEXT,
    "website" TEXT,
    "business_description" TEXT,
    "intended_use_case" TEXT,
    "expected_monthly_volume" TEXT,
    "expected_destinations" TEXT,
    "caller_id_info" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "status" "KycRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "more_info_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kyc_records_organization_id_key" ON "kyc_records"("organization_id");
CREATE INDEX "kyc_records_status_idx" ON "kyc_records"("status");
CREATE INDEX "kyc_records_reviewed_by_id_idx" ON "kyc_records"("reviewed_by_id");

CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "kyc_record_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content_type" TEXT,
    "storage_key" TEXT,
    "source" TEXT NOT NULL DEFAULT 'METADATA_ONLY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kyc_documents_kyc_record_id_idx" ON "kyc_documents"("kyc_record_id");
CREATE INDEX "kyc_documents_type_idx" ON "kyc_documents"("type");

ALTER TABLE "kyc_records" ADD CONSTRAINT "kyc_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kyc_records" ADD CONSTRAINT "kyc_records_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_kyc_record_id_fkey" FOREIGN KEY ("kyc_record_id") REFERENCES "kyc_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
