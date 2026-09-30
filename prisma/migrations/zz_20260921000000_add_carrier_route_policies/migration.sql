-- CreateTable
CREATE TABLE "carrier_route_policies" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT,
    "country_iso" TEXT NOT NULL,
    "destination_type" "DestinationType" NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_cps_override" INTEGER,
    "max_channels_override" INTEGER,
    "cli_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_route_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carrier_route_policies_organization_id_idx" ON "carrier_route_policies"("organization_id");

-- CreateIndex
CREATE INDEX "carrier_route_policies_carrier_id_idx" ON "carrier_route_policies"("carrier_id");

-- CreateIndex
CREATE INDEX "carrier_route_policies_cli_profile_id_idx" ON "carrier_route_policies"("cli_profile_id");

-- CreateIndex
CREATE INDEX "carrier_route_policies_org_country_type_enabled_priority_idx" ON "carrier_route_policies"("organization_id", "country_iso", "destination_type", "enabled", "priority");

-- AddForeignKey
ALTER TABLE "carrier_route_policies" ADD CONSTRAINT "carrier_route_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_route_policies" ADD CONSTRAINT "carrier_route_policies_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_route_policies" ADD CONSTRAINT "carrier_route_policies_cli_profile_id_fkey" FOREIGN KEY ("cli_profile_id") REFERENCES "carrier_cli_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
