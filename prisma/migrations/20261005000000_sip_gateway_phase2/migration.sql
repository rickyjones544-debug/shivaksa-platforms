-- Phase 2: Asterisk SIP gateway integration.
-- SipAccount: global username uniqueness + provisioning/registration state.
-- Carrier: Asterisk endpoint name for SIP_GATEWAY carriers.
-- ProvisioningTask: work queue between platform and the on-VPS gateway agent.
-- Verified safe: sip_accounts contained 0 rows (no username conflicts) before
-- the global unique index was added.

-- AlterTable
ALTER TABLE "carriers" ADD COLUMN     "gateway_endpoint" TEXT;

-- AlterTable
ALTER TABLE "sip_accounts" ADD COLUMN     "asterisk_endpoint" TEXT,
ADD COLUMN     "last_contact_address" TEXT,
ADD COLUMN     "last_registered_at" TIMESTAMP(3),
ADD COLUMN     "provisioned_at" TIMESTAMP(3),
ADD COLUMN     "provisioning_error" TEXT,
ADD COLUMN     "provisioning_state" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "registration_observed_at" TIMESTAMP(3),
ADD COLUMN     "registration_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "registration_user_agent" TEXT,
ADD COLUMN     "transport" TEXT NOT NULL DEFAULT 'UDP';

-- CreateTable
CREATE TABLE "provisioning_tasks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sip_account_id" TEXT,
    "call_id" TEXT,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provisioning_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provisioning_tasks_status_idx" ON "provisioning_tasks"("status");

-- CreateIndex
CREATE INDEX "provisioning_tasks_sip_account_id_idx" ON "provisioning_tasks"("sip_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sip_accounts_username_key" ON "sip_accounts"("username");

-- CreateIndex
CREATE INDEX "sip_accounts_provisioning_state_idx" ON "sip_accounts"("provisioning_state");

-- CreateIndex
CREATE INDEX "sip_accounts_registration_status_idx" ON "sip_accounts"("registration_status");

-- AddForeignKey
ALTER TABLE "provisioning_tasks" ADD CONSTRAINT "provisioning_tasks_sip_account_id_fkey" FOREIGN KEY ("sip_account_id") REFERENCES "sip_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
