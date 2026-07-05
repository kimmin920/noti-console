CREATE TYPE "public"."sms_bulk_send_batch_status" AS ENUM('pending', 'sending', 'accepted', 'rejected', 'unknown', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."sms_bulk_send_channel" AS ENUM('sms', 'lms', 'mms');--> statement-breakpoint
CREATE TYPE "public"."sms_bulk_send_run_status" AS ENUM('queued', 'running', 'completed', 'blocked', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."sms_quota_reservation_status" AS ENUM('reserved', 'consumed', 'released');--> statement-breakpoint
CREATE TYPE "public"."sms_quota_scope" AS ENUM('user_period');--> statement-breakpoint
CREATE TABLE "sms_bulk_send_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"recipient_count" integer NOT NULL,
	"status" "sms_bulk_send_batch_status" DEFAULT 'pending' NOT NULL,
	"client_request_id" uuid NOT NULL,
	"provider_request_id" varchar(128),
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_by" varchar(120),
	"lease_expires_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" varchar(80),
	"error_state" varchar(80),
	"error_message" varchar(500),
	"payload_json" jsonb,
	"payload_expires_at" timestamp with time zone,
	"payload_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_bulk_send_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_ref" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"sender_resource_id" uuid NOT NULL,
	"billing_account_id" uuid,
	"channel" "sms_bulk_send_channel" DEFAULT 'sms' NOT NULL,
	"management_send_name" varchar(160),
	"total_recipients" integer NOT NULL,
	"batch_size" integer NOT NULL,
	"total_batches" integer NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"unknown_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" "sms_bulk_send_run_status" DEFAULT 'queued' NOT NULL,
	"next_batch_available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" varchar(80),
	"error_state" varchar(80),
	"error_message" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_quota_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "sms_bulk_send_channel" DEFAULT 'sms' NOT NULL,
	"quota_scope" "sms_quota_scope" DEFAULT 'user_period' NOT NULL,
	"period_start_at" timestamp with time zone NOT NULL,
	"period_end_at" timestamp with time zone NOT NULL,
	"quota_limit" integer NOT NULL,
	"reserved_count" integer DEFAULT 0 NOT NULL,
	"consumed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_quota_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "sms_bulk_send_channel" DEFAULT 'sms' NOT NULL,
	"quota_scope" "sms_quota_scope" DEFAULT 'user_period' NOT NULL,
	"reserved_count" integer NOT NULL,
	"consumed_count" integer DEFAULT 0 NOT NULL,
	"released_count" integer DEFAULT 0 NOT NULL,
	"status" "sms_quota_reservation_status" DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_bulk_send_batches" ADD CONSTRAINT "sms_bulk_send_batches_run_id_sms_bulk_send_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sms_bulk_send_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_bulk_send_runs" ADD CONSTRAINT "sms_bulk_send_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_bulk_send_runs" ADD CONSTRAINT "sms_bulk_send_runs_sender_resource_id_sender_resources_id_fk" FOREIGN KEY ("sender_resource_id") REFERENCES "public"."sender_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_bulk_send_runs" ADD CONSTRAINT "sms_bulk_send_runs_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_quota_buckets" ADD CONSTRAINT "sms_quota_buckets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_quota_reservations" ADD CONSTRAINT "sms_quota_reservations_bucket_id_sms_quota_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."sms_quota_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_quota_reservations" ADD CONSTRAINT "sms_quota_reservations_run_id_sms_bulk_send_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sms_bulk_send_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_quota_reservations" ADD CONSTRAINT "sms_quota_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sms_bulk_send_batches_run_sequence_unique" ON "sms_bulk_send_batches" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_bulk_send_batches_client_request_unique" ON "sms_bulk_send_batches" USING btree ("client_request_id");--> statement-breakpoint
CREATE INDEX "sms_bulk_send_batches_run_sequence_idx" ON "sms_bulk_send_batches" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "sms_bulk_send_batches_worker_claim_idx" ON "sms_bulk_send_batches" USING btree ("status","lease_expires_at","sequence");--> statement-breakpoint
CREATE INDEX "sms_bulk_send_batches_payload_cleanup_idx" ON "sms_bulk_send_batches" USING btree ("payload_expires_at","payload_purged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_bulk_send_runs_run_ref_unique" ON "sms_bulk_send_runs" USING btree ("run_ref");--> statement-breakpoint
CREATE INDEX "sms_bulk_send_runs_worker_claim_idx" ON "sms_bulk_send_runs" USING btree ("status","next_batch_available_at","updated_at");--> statement-breakpoint
CREATE INDEX "sms_bulk_send_runs_user_recent_idx" ON "sms_bulk_send_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sms_bulk_send_runs_sender_resource_idx" ON "sms_bulk_send_runs" USING btree ("sender_resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_quota_buckets_scope_unique" ON "sms_quota_buckets" USING btree ("user_id","channel","quota_scope","period_start_at","period_end_at");--> statement-breakpoint
CREATE INDEX "sms_quota_buckets_lookup_idx" ON "sms_quota_buckets" USING btree ("user_id","channel","quota_scope","period_end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_quota_reservations_run_unique" ON "sms_quota_reservations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "sms_quota_reservations_bucket_status_idx" ON "sms_quota_reservations" USING btree ("bucket_id","status");--> statement-breakpoint
CREATE INDEX "sms_quota_reservations_user_recent_idx" ON "sms_quota_reservations" USING btree ("user_id","created_at");