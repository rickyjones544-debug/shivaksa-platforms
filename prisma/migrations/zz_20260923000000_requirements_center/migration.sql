-- Requirements Center (Phase 2).
-- Additive only: new enums, new tables, new indexes and foreign keys.
-- No existing table is altered; no existing data is touched.

-- CreateEnum
CREATE TYPE "RequirementSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequirementVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequirementVisibility" AS ENUM ('INTERNAL', 'PUBLISHABLE');

-- CreateTable
CREATE TABLE "requirement_sets" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RequirementSetStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_sections" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "requirement_set_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "RequirementVisibility" NOT NULL DEFAULT 'INTERNAL',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_versions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "requirement_set_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "RequirementVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "change_summary" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by_id" TEXT,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_version_sections" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "requirement_version_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "RequirementVisibility" NOT NULL DEFAULT 'INTERNAL',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_version_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_sets_organization_id_idx" ON "requirement_sets"("organization_id");

-- CreateIndex
CREATE INDEX "requirement_sets_status_idx" ON "requirement_sets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_sets_organization_id_name_key" ON "requirement_sets"("organization_id", "name");

-- CreateIndex
CREATE INDEX "requirement_sections_requirement_set_id_idx" ON "requirement_sections"("requirement_set_id");

-- CreateIndex
CREATE INDEX "requirement_sections_visibility_idx" ON "requirement_sections"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_sections_requirement_set_id_key_key" ON "requirement_sections"("requirement_set_id", "key");

-- CreateIndex
CREATE INDEX "requirement_versions_requirement_set_id_idx" ON "requirement_versions"("requirement_set_id");

-- CreateIndex
CREATE INDEX "requirement_versions_status_idx" ON "requirement_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_versions_requirement_set_id_version_number_key" ON "requirement_versions"("requirement_set_id", "version_number");

-- CreateIndex
CREATE INDEX "requirement_version_sections_requirement_version_id_idx" ON "requirement_version_sections"("requirement_version_id");

-- CreateIndex
CREATE INDEX "requirement_version_sections_visibility_idx" ON "requirement_version_sections"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_version_sections_requirement_version_id_key_key" ON "requirement_version_sections"("requirement_version_id", "key");

-- AddForeignKey
ALTER TABLE "requirement_sets" ADD CONSTRAINT "requirement_sets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_sets" ADD CONSTRAINT "requirement_sets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_sets" ADD CONSTRAINT "requirement_sets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_sections" ADD CONSTRAINT "requirement_sections_requirement_set_id_fkey" FOREIGN KEY ("requirement_set_id") REFERENCES "requirement_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_requirement_set_id_fkey" FOREIGN KEY ("requirement_set_id") REFERENCES "requirement_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_version_sections" ADD CONSTRAINT "requirement_version_sections_requirement_version_id_fkey" FOREIGN KEY ("requirement_version_id") REFERENCES "requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
