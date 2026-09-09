-- CreateTable
CREATE TABLE "voip_services" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_admin_suspended" BOOLEAN NOT NULL DEFAULT false,
    "customer_rate" DECIMAL(12,6) NOT NULL DEFAULT 0.016,
    "billing_increment_seconds" INTEGER NOT NULL DEFAULT 60,
    "minimum_billable_seconds" INTEGER NOT NULL DEFAULT 60,
    "reserve_minutes" INTEGER NOT NULL DEFAULT 5,
    "low_balance_thresholds" INTEGER[],
    "max_call_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voip_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "balance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "balance_after" DECIMAL(12,4) NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_reservations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" TEXT NOT NULL,
    "call_id" TEXT,
    "amount" DECIMAL(12,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),

    CONSTRAINT "wallet_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sip_accounts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_cipher" TEXT NOT NULL,
    "password_tag" TEXT NOT NULL,
    "password_iv" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "max_concurrent_calls" INTEGER NOT NULL DEFAULT 1,
    "caller_id" TEXT,
    "provider_connection_id" TEXT,
    "provider_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sip_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "sip_account_id" TEXT,
    "number" TEXT NOT NULL,
    "display_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT NOT NULL DEFAULT 'telnyx',
    "provider_number_id" TEXT,
    "provider_connection_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voip_calls" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "sip_account_id" TEXT,
    "phone_number_id" TEXT,
    "direction" TEXT NOT NULL,
    "caller_id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "provider" TEXT NOT NULL DEFAULT 'telnyx',
    "provider_call_id" TEXT,
    "start_time" TIMESTAMP(3),
    "answer_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "billable_seconds" INTEGER,
    "billed_minutes" DECIMAL(12,4),
    "customer_rate" DECIMAL(12,6) NOT NULL,
    "customer_charge" DECIMAL(12,4),
    "wholesale_cost" DECIMAL(12,4),
    "gross_profit" DECIMAL(12,4),
    "failure_reason" TEXT,
    "routing_info" JSONB,
    "reservation_id" TEXT,
    "billing_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voip_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "call_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "threshold_minutes" INTEGER,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" TEXT,
    "organization_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voip_services_organization_id_key" ON "voip_services"("organization_id");

-- CreateIndex
CREATE INDEX "voip_services_organization_id_idx" ON "voip_services"("organization_id");

-- CreateIndex
CREATE INDEX "voip_services_status_idx" ON "voip_services"("status");

-- CreateIndex
CREATE INDEX "voip_services_is_admin_suspended_idx" ON "voip_services"("is_admin_suspended");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_organization_id_key" ON "wallets"("organization_id");

-- CreateIndex
CREATE INDEX "wallets_organization_id_idx" ON "wallets"("organization_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_reservations_call_id_key" ON "wallet_reservations"("call_id");

-- CreateIndex
CREATE INDEX "wallet_reservations_wallet_id_idx" ON "wallet_reservations"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_reservations_call_id_idx" ON "wallet_reservations"("call_id");

-- CreateIndex
CREATE INDEX "wallet_reservations_status_idx" ON "wallet_reservations"("status");

-- CreateIndex
CREATE INDEX "sip_accounts_organization_id_idx" ON "sip_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "sip_accounts_status_idx" ON "sip_accounts"("status");

-- CreateIndex
CREATE INDEX "sip_accounts_provider_connection_id_idx" ON "sip_accounts"("provider_connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "sip_accounts_organization_id_username_key" ON "sip_accounts"("organization_id", "username");

-- CreateIndex
CREATE INDEX "phone_numbers_organization_id_idx" ON "phone_numbers"("organization_id");

-- CreateIndex
CREATE INDEX "phone_numbers_number_idx" ON "phone_numbers"("number");

-- CreateIndex
CREATE INDEX "phone_numbers_sip_account_id_idx" ON "phone_numbers"("sip_account_id");

-- CreateIndex
CREATE INDEX "phone_numbers_provider_number_id_idx" ON "phone_numbers"("provider_number_id");

-- CreateIndex
CREATE INDEX "phone_numbers_provider_connection_id_idx" ON "phone_numbers"("provider_connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_organization_id_number_key" ON "phone_numbers"("organization_id", "number");

-- CreateIndex
CREATE INDEX "voip_calls_organization_id_idx" ON "voip_calls"("organization_id");

-- CreateIndex
CREATE INDEX "voip_calls_sip_account_id_idx" ON "voip_calls"("sip_account_id");

-- CreateIndex
CREATE INDEX "voip_calls_phone_number_id_idx" ON "voip_calls"("phone_number_id");

-- CreateIndex
CREATE INDEX "voip_calls_provider_provider_call_id_idx" ON "voip_calls"("provider", "provider_call_id");

-- CreateIndex
CREATE INDEX "voip_calls_status_idx" ON "voip_calls"("status");

-- CreateIndex
CREATE INDEX "voip_calls_created_at_idx" ON "voip_calls"("created_at");

-- CreateIndex
CREATE INDEX "voip_calls_destination_idx" ON "voip_calls"("destination");

-- CreateIndex
CREATE INDEX "voip_calls_start_time_idx" ON "voip_calls"("start_time");

-- CreateIndex
CREATE INDEX "webhook_events_provider_provider_event_id_idx" ON "webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "webhook_events_call_id_idx" ON "webhook_events"("call_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_provider_event_id_key" ON "webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_sent_at_idx" ON "notifications"("sent_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "voip_services" ADD CONSTRAINT "voip_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_reservations" ADD CONSTRAINT "wallet_reservations_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "voip_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sip_accounts" ADD CONSTRAINT "sip_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_sip_account_id_fkey" FOREIGN KEY ("sip_account_id") REFERENCES "sip_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voip_calls" ADD CONSTRAINT "voip_calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voip_calls" ADD CONSTRAINT "voip_calls_sip_account_id_fkey" FOREIGN KEY ("sip_account_id") REFERENCES "sip_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voip_calls" ADD CONSTRAINT "voip_calls_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "voip_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
