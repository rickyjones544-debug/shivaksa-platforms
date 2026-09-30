-- Provider CRM data foundation (Phase 1).
-- Additive only: new enums, new tables, new indexes and foreign keys.
-- No existing table is altered; no existing data is touched.

-- CreateEnum
CREATE TYPE "ProviderLifecycleStage" AS ENUM ('PROSPECT', 'CONTACTED', 'IN_REVIEW', 'COMMERCIAL_REVIEW', 'TECHNICAL_REVIEW', 'AGREEMENT_PENDING', 'AGREEMENT_ACTIVE', 'CONNECTIVITY_PENDING', 'CONNECTIVITY_ACTIVE', 'TRAFFIC_ACTIVE', 'SUSPENDED', 'INACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProviderContactRole" AS ENUM ('SALES', 'NOC', 'TECHNICAL', 'BILLING', 'RATES', 'ACCOUNT_MANAGER', 'OTHER');

-- CreateEnum
CREATE TYPE "ProviderSubmissionStatus" AS ENUM ('NEW', 'REVIEWING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProviderTaskType" AS ENUM ('FOLLOW_UP', 'RATE_REQUEST', 'CONNECTIVITY', 'CLI', 'CDR', 'AGREEMENT', 'BILLING', 'TECHNICAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "ProviderTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "trading_name" TEXT,
    "website" TEXT,
    "country" TEXT,
    "lifecycle_stage" "ProviderLifecycleStage" NOT NULL DEFAULT 'PROSPECT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "carrier_id" TEXT,
    "stage_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_contacts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" TEXT NOT NULL,
    "role" "ProviderContactRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_links" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "max_submissions" INTEGER,
    "access_code_hash" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_submissions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "onboarding_link_id" TEXT,
    "provider_id" TEXT,
    "company_name" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT,
    "contact_email" TEXT,
    "status" "ProviderSubmissionStatus" NOT NULL DEFAULT 'NEW',
    "payload" JSONB NOT NULL,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_notes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_tasks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" TEXT NOT NULL,
    "type" "ProviderTaskType" NOT NULL DEFAULT 'GENERAL',
    "status" "ProviderTaskStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee_id" TEXT,
    "due_date" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_carrier_id_key" ON "providers"("carrier_id");

-- CreateIndex
CREATE INDEX "providers_organization_id_idx" ON "providers"("organization_id");

-- CreateIndex
CREATE INDEX "providers_lifecycle_stage_idx" ON "providers"("lifecycle_stage");

-- CreateIndex
CREATE INDEX "providers_status_idx" ON "providers"("status");

-- CreateIndex
CREATE INDEX "providers_country_idx" ON "providers"("country");

-- CreateIndex
CREATE INDEX "provider_contacts_provider_id_idx" ON "provider_contacts"("provider_id");

-- CreateIndex
CREATE INDEX "provider_contacts_role_idx" ON "provider_contacts"("role");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_links_token_hash_key" ON "onboarding_links"("token_hash");

-- CreateIndex
CREATE INDEX "onboarding_links_token_hash_idx" ON "onboarding_links"("token_hash");

-- CreateIndex
CREATE INDEX "onboarding_links_organization_id_idx" ON "onboarding_links"("organization_id");

-- CreateIndex
CREATE INDEX "provider_submissions_organization_id_idx" ON "provider_submissions"("organization_id");

-- CreateIndex
CREATE INDEX "provider_submissions_status_idx" ON "provider_submissions"("status");

-- CreateIndex
CREATE INDEX "provider_submissions_onboarding_link_id_idx" ON "provider_submissions"("onboarding_link_id");

-- CreateIndex
CREATE INDEX "provider_submissions_provider_id_idx" ON "provider_submissions"("provider_id");

-- CreateIndex
CREATE INDEX "provider_submissions_contact_email_idx" ON "provider_submissions"("contact_email");

-- CreateIndex
CREATE INDEX "provider_notes_provider_id_idx" ON "provider_notes"("provider_id");

-- CreateIndex
CREATE INDEX "provider_notes_author_id_idx" ON "provider_notes"("author_id");

-- CreateIndex
CREATE INDEX "provider_tasks_provider_id_idx" ON "provider_tasks"("provider_id");

-- CreateIndex
CREATE INDEX "provider_tasks_status_idx" ON "provider_tasks"("status");

-- CreateIndex
CREATE INDEX "provider_tasks_assignee_id_idx" ON "provider_tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "provider_tasks_due_date_idx" ON "provider_tasks"("due_date");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_contacts" ADD CONSTRAINT "provider_contacts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_submissions" ADD CONSTRAINT "provider_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_submissions" ADD CONSTRAINT "provider_submissions_onboarding_link_id_fkey" FOREIGN KEY ("onboarding_link_id") REFERENCES "onboarding_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_submissions" ADD CONSTRAINT "provider_submissions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_submissions" ADD CONSTRAINT "provider_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_notes" ADD CONSTRAINT "provider_notes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_notes" ADD CONSTRAINT "provider_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_tasks" ADD CONSTRAINT "provider_tasks_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_tasks" ADD CONSTRAINT "provider_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_tasks" ADD CONSTRAINT "provider_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
