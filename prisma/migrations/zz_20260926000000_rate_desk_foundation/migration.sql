-- Rate Desk foundation (Phase 4A).
-- Additive only: four new enums, three new tables, indexes, and foreign keys.
-- No existing table is altered; no existing data is touched.
-- These tables are structurally separate from carriers/carrier_rates — nothing
-- here activates routing, credentials, or traffic.

-- CreateEnum
CREATE TYPE "ProviderRateSheetStatus" AS ENUM ('RECEIVED', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProviderRateSheetVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProviderRateSheetSource" AS ENUM ('MANUAL', 'EMAIL', 'SUBMISSION', 'SUBMISSION_DOCUMENT', 'API');

-- CreateEnum
CREATE TYPE "ProviderRateRouteType" AS ENUM ('FIXED', 'MOBILE', 'BOTH');

-- CreateTable
CREATE TABLE "provider_rate_sheets" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" "ProviderRateSheetSource" NOT NULL DEFAULT 'MANUAL',
    "source_document_id" TEXT,
    "status" "ProviderRateSheetStatus" NOT NULL DEFAULT 'RECEIVED',
    "current_version" INTEGER,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_rate_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_rate_sheet_versions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "sheet_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProviderRateSheetVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_rate_sheet_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_rates" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "destination" TEXT,
    "country_iso" TEXT,
    "prefix" TEXT NOT NULL,
    "route_type" "ProviderRateRouteType" NOT NULL,
    "rate" DECIMAL(14,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "first_increment_seconds" INTEGER NOT NULL DEFAULT 1,
    "increment_seconds" INTEGER NOT NULL DEFAULT 1,
    "minimum_duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_rate_sheets_organization_id_idx" ON "provider_rate_sheets"("organization_id");

-- CreateIndex
CREATE INDEX "provider_rate_sheets_provider_id_idx" ON "provider_rate_sheets"("provider_id");

-- CreateIndex
CREATE INDEX "provider_rate_sheets_status_idx" ON "provider_rate_sheets"("status");

-- CreateIndex
CREATE INDEX "provider_rate_sheets_source_document_id_idx" ON "provider_rate_sheets"("source_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_rate_sheet_versions_sheet_id_version_key" ON "provider_rate_sheet_versions"("sheet_id", "version");

-- CreateIndex
CREATE INDEX "provider_rate_sheet_versions_organization_id_idx" ON "provider_rate_sheet_versions"("organization_id");

-- CreateIndex
CREATE INDEX "provider_rate_sheet_versions_status_idx" ON "provider_rate_sheet_versions"("status");

-- CreateIndex
CREATE INDEX "provider_rates_organization_id_idx" ON "provider_rates"("organization_id");

-- CreateIndex
CREATE INDEX "provider_rates_provider_id_idx" ON "provider_rates"("provider_id");

-- CreateIndex
CREATE INDEX "provider_rates_version_id_idx" ON "provider_rates"("version_id");

-- CreateIndex
CREATE INDEX "provider_rates_prefix_idx" ON "provider_rates"("prefix");

-- CreateIndex
CREATE INDEX "provider_rates_country_iso_idx" ON "provider_rates"("country_iso");

-- CreateIndex
CREATE INDEX "provider_rates_organization_id_provider_id_prefix_route__idx" ON "provider_rates"("organization_id", "provider_id", "prefix", "route_type", "effective_from", "effective_to");

-- AddForeignKey
ALTER TABLE "provider_rate_sheets" ADD CONSTRAINT "provider_rate_sheets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rate_sheets" ADD CONSTRAINT "provider_rate_sheets_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rate_sheets" ADD CONSTRAINT "provider_rate_sheets_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "provider_submission_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rate_sheets" ADD CONSTRAINT "provider_rate_sheets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rate_sheet_versions" ADD CONSTRAINT "provider_rate_sheet_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rate_sheet_versions" ADD CONSTRAINT "provider_rate_sheet_versions_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "provider_rate_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rate_sheet_versions" ADD CONSTRAINT "provider_rate_sheet_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rates" ADD CONSTRAINT "provider_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rates" ADD CONSTRAINT "provider_rates_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rates" ADD CONSTRAINT "provider_rates_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "provider_rate_sheet_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
