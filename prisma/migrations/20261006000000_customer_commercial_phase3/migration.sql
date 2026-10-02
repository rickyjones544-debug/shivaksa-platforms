-- Phase 3: customer commercial layer.
-- Adds customer selling-rate cards/rates, historical pricing snapshot columns
-- on voip_calls, and monthly usage aggregates. All new objects are additive;
-- no existing columns or data are modified.

-- AlterTable
ALTER TABLE "voip_calls" ADD COLUMN     "billing_increment_seconds" INTEGER,
ADD COLUMN     "customer_rate_card_id" TEXT,
ADD COLUMN     "customer_rate_id" TEXT,
ADD COLUMN     "minimum_billable_seconds" INTEGER;

-- CreateTable
CREATE TABLE "customer_rate_cards" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_rates" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "rate_card_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "destination" TEXT,
    "country" TEXT,
    "rate" DECIMAL(12,6) NOT NULL,
    "billing_increment_seconds" INTEGER NOT NULL DEFAULT 60,
    "minimum_billable_seconds" INTEGER NOT NULL DEFAULT 60,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_aggregates" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "answered_calls" INTEGER NOT NULL DEFAULT 0,
    "failed_calls" INTEGER NOT NULL DEFAULT 0,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "billable_seconds" INTEGER NOT NULL DEFAULT 0,
    "customer_spend" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_rate_cards_organization_id_status_idx" ON "customer_rate_cards"("organization_id", "status");

-- CreateIndex
CREATE INDEX "customer_rates_rate_card_id_idx" ON "customer_rates"("rate_card_id");

-- CreateIndex
CREATE INDEX "customer_rates_prefix_idx" ON "customer_rates"("prefix");

-- CreateIndex
CREATE INDEX "customer_rates_rate_card_id_prefix_enabled_idx" ON "customer_rates"("rate_card_id", "prefix", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "usage_aggregates_organization_id_period_start_key" ON "usage_aggregates"("organization_id", "period_start");

-- CreateIndex
CREATE INDEX "voip_calls_organization_id_created_at_idx" ON "voip_calls"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "voip_calls_organization_id_status_idx" ON "voip_calls"("organization_id", "status");

-- CreateIndex
CREATE INDEX "voip_calls_customer_rate_card_id_idx" ON "voip_calls"("customer_rate_card_id");

-- CreateIndex
CREATE INDEX "voip_calls_customer_rate_id_idx" ON "voip_calls"("customer_rate_id");

-- AddForeignKey
ALTER TABLE "voip_calls" ADD CONSTRAINT "voip_calls_customer_rate_card_id_fkey" FOREIGN KEY ("customer_rate_card_id") REFERENCES "customer_rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voip_calls" ADD CONSTRAINT "voip_calls_customer_rate_id_fkey" FOREIGN KEY ("customer_rate_id") REFERENCES "customer_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_rate_cards" ADD CONSTRAINT "customer_rate_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_rates" ADD CONSTRAINT "customer_rates_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "customer_rate_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
