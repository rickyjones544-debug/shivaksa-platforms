-- Wholesale Profile (Phase 3A).
-- Additive only: new enum, new table, new indexes and foreign keys.
-- No existing table is altered; no existing data is touched.

-- CreateEnum
CREATE TYPE "WholesaleProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "wholesale_profiles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "requirement_set_id" TEXT NOT NULL,
    "published_version_number" INTEGER,
    "status" "WholesaleProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wholesale_profiles_requirement_set_id_idx" ON "wholesale_profiles"("requirement_set_id");

-- CreateIndex
CREATE INDEX "wholesale_profiles_status_idx" ON "wholesale_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wholesale_profiles_organization_id_key" ON "wholesale_profiles"("organization_id");

-- AddForeignKey
ALTER TABLE "wholesale_profiles" ADD CONSTRAINT "wholesale_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_profiles" ADD CONSTRAINT "wholesale_profiles_requirement_set_id_fkey" FOREIGN KEY ("requirement_set_id") REFERENCES "requirement_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_profiles" ADD CONSTRAINT "wholesale_profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_profiles" ADD CONSTRAINT "wholesale_profiles_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
