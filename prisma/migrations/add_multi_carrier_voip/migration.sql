-- CreateEnum
CREATE TYPE "CarrierType" AS ENUM ('API', 'SIP_GATEWAY');

-- CreateEnum
CREATE TYPE "CarrierAuthType" AS ENUM ('IP_AUTH', 'CREDENTIAL_AUTH');

-- CreateEnum
CREATE TYPE "CarrierStatus" AS ENUM ('TEST', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Transport" AS ENUM ('UDP', 'TCP', 'TLS');

-- CreateEnum
CREATE TYPE "CliMode" AS ENUM ('FIXED', 'POOL', 'PASS_THROUGH');

-- CreateEnum
CREATE TYPE "DestinationType" AS ENUM ('FIXED', 'MOBILE', 'ALL');

-- AlterTable
ALTER TABLE "phone_numbers" ADD COLUMN     "carrier_id" TEXT;

-- AlterTable
ALTER TABLE "voip_calls" ADD COLUMN     "carrier_id" TEXT,
ADD COLUMN     "carrier_rate_id" TEXT,
ADD COLUMN     "destination_country" TEXT,
ADD COLUMN     "destination_type" TEXT,
ADD COLUMN     "gateway_call_id" TEXT,
ADD COLUMN     "normalized_destination" TEXT,
ADD COLUMN     "sip_response_code" INTEGER,
ADD COLUMN     "wholesale_rate" DECIMAL(12,6);

-- CreateTable
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CarrierType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "CarrierStatus" NOT NULL DEFAULT 'TEST',
    "authentication_type" "CarrierAuthType" NOT NULL,
    "remote_host" TEXT,
    "remote_port" INTEGER,
    "transport" "Transport" NOT NULL DEFAULT 'UDP',
    "local_host" TEXT,
    "local_port" INTEGER,
    "tech_prefix" TEXT,
    "codecs" TEXT[],
    "max_channels" INTEGER,
    "max_cps" INTEGER,
    "billing_increment_seconds" INTEGER NOT NULL DEFAULT 60,
    "minimum_billable_seconds" INTEGER NOT NULL DEFAULT 60,
    "default_caller_id" TEXT,
    "cli_mode" "CliMode" NOT NULL DEFAULT 'PASS_THROUGH',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_credentials" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "carrier_id" TEXT NOT NULL,
    "username" TEXT,
    "password_cipher" TEXT NOT NULL,
    "password_tag" TEXT NOT NULL,
    "password_iv" TEXT NOT NULL,
    "realm" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_rates" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "carrier_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "country" TEXT,
    "destination_type" "DestinationType" NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "billing_increment_seconds" INTEGER NOT NULL DEFAULT 60,
    "minimum_billable_seconds" INTEGER NOT NULL DEFAULT 60,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_cli_profiles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "carrier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_cli" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_cli_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_cli_entries" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "cli_profile_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowed_countries" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_cli_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carriers_code_key" ON "carriers"("code");

-- CreateIndex
CREATE INDEX "carriers_organization_id_idx" ON "carriers"("organization_id");

-- CreateIndex
CREATE INDEX "carriers_code_idx" ON "carriers"("code");

-- CreateIndex
CREATE INDEX "carriers_enabled_idx" ON "carriers"("enabled");

-- CreateIndex
CREATE INDEX "carriers_status_idx" ON "carriers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_credentials_carrier_id_key" ON "carrier_credentials"("carrier_id");

-- CreateIndex
CREATE INDEX "carrier_rates_carrier_id_idx" ON "carrier_rates"("carrier_id");

-- CreateIndex
CREATE INDEX "carrier_rates_prefix_idx" ON "carrier_rates"("prefix");

-- CreateIndex
CREATE INDEX "carrier_rates_country_idx" ON "carrier_rates"("country");

-- CreateIndex
CREATE INDEX "carrier_rates_destination_type_idx" ON "carrier_rates"("destination_type");

-- CreateIndex
CREATE INDEX "carrier_rates_enabled_idx" ON "carrier_rates"("enabled");

-- CreateIndex
CREATE INDEX "carrier_rates_effective_from_idx" ON "carrier_rates"("effective_from");

-- CreateIndex
CREATE INDEX "carrier_rates_effective_to_idx" ON "carrier_rates"("effective_to");

-- CreateIndex
CREATE INDEX "carrier_rates_priority_idx" ON "carrier_rates"("priority");

-- CreateIndex
CREATE INDEX "carrier_rates_carrier_id_prefix_destination_type_enabled_ef_idx" ON "carrier_rates"("carrier_id", "prefix", "destination_type", "enabled", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "carrier_cli_profiles_carrier_id_idx" ON "carrier_cli_profiles"("carrier_id");

-- CreateIndex
CREATE INDEX "carrier_cli_entries_cli_profile_id_idx" ON "carrier_cli_entries"("cli_profile_id");

-- CreateIndex
CREATE INDEX "phone_numbers_carrier_id_idx" ON "phone_numbers"("carrier_id");

-- CreateIndex
CREATE INDEX "voip_calls_carrier_id_idx" ON "voip_calls"("carrier_id");

-- CreateIndex
CREATE INDEX "voip_calls_carrier_rate_id_idx" ON "voip_calls"("carrier_rate_id");

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_credentials" ADD CONSTRAINT "carrier_credentials_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_rates" ADD CONSTRAINT "carrier_rates_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_cli_profiles" ADD CONSTRAINT "carrier_cli_profiles_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_cli_entries" ADD CONSTRAINT "carrier_cli_entries_cli_profile_id_fkey" FOREIGN KEY ("cli_profile_id") REFERENCES "carrier_cli_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voip_calls" ADD CONSTRAINT "voip_calls_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voip_calls" ADD CONSTRAINT "voip_calls_carrier_rate_id_fkey" FOREIGN KEY ("carrier_rate_id") REFERENCES "carrier_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
