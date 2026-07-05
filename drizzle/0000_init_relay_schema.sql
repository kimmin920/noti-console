CREATE TYPE "public"."billing_account_owner_type" AS ENUM('user', 'workspace');--> statement-breakpoint
CREATE TYPE "public"."billing_account_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."evidence_file_status" AS ENUM('active', 'delete_pending', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."external_auth_provider" AS ENUM('clerk', 'publ', 'google', 'kakao');--> statement-breakpoint
CREATE TYPE "public"."sender_resource_application_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."sender_resource_provider" AS ENUM('nhn');--> statement-breakpoint
CREATE TYPE "public"."sender_resource_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sender_resource_type" AS ENUM('sms_send_no', 'kakao_sender_key');--> statement-breakpoint
CREATE TYPE "public"."settlement_channel" AS ENUM('alimtalk', 'sms', 'lms', 'mms');--> statement-breakpoint
CREATE TYPE "public"."settlement_run_status" AS ENUM('running', 'succeeded', 'failed', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."settlement_usage_type" AS ENUM('direct', 'fallback', 'resend', 'all');--> statement-breakpoint
CREATE TYPE "public"."user_sender_resource_role" AS ENUM('owner', 'sender', 'viewer', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."user_sender_resource_status" AS ENUM('pending', 'active', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(120) NOT NULL,
	"target_type" varchar(120) NOT NULL,
	"target_id" varchar(128),
	"metadata_json" jsonb,
	"ip_address_hash" varchar(128),
	"user_agent_summary" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_ref" varchar(20) NOT NULL,
	"owner_type" "billing_account_owner_type" DEFAULT 'user' NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "billing_account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "external_auth_provider" NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"email" varchar(320),
	"display_name" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sender_resource_application_evidence_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"r2_bucket" varchar(128) NOT NULL,
	"r2_object_key" varchar(512) NOT NULL,
	"original_file_name" varchar(255),
	"content_type" varchar(120),
	"byte_size" bigint,
	"checksum_sha256" varchar(64),
	"status" "evidence_file_status" DEFAULT 'active' NOT NULL,
	"uploaded_by" uuid,
	"delete_after" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sender_resource_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_type" "sender_resource_type" NOT NULL,
	"requested_value" varchar(128) NOT NULL,
	"status" "sender_resource_application_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_memo" varchar(1000),
	"reject_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sender_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_ref" varchar(20) NOT NULL,
	"provider" "sender_resource_provider" DEFAULT 'nhn' NOT NULL,
	"type" "sender_resource_type" NOT NULL,
	"value" varchar(128) NOT NULL,
	"display_name" varchar(120),
	"status" "sender_resource_status" DEFAULT 'active' NOT NULL,
	"provider_status" varchar(80),
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_receive_date" timestamp with time zone NOT NULL,
	"end_receive_date" timestamp with time zone NOT NULL,
	"status" "settlement_run_status" DEFAULT 'running' NOT NULL,
	"requested_by" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"finalized_by" uuid,
	"finalized_at" timestamp with time zone,
	"error_message" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_usage_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "settlement_channel" NOT NULL,
	"usage_type" "settlement_usage_type" DEFAULT 'all' NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sender_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sender_resource_id" uuid NOT NULL,
	"billing_account_id" uuid,
	"role" "user_sender_resource_role" DEFAULT 'sender' NOT NULL,
	"status" "user_sender_resource_status" DEFAULT 'pending' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_ref" varchar(20) NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(120),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_operator" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_auth_accounts" ADD CONSTRAINT "external_auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_resource_application_evidence_files" ADD CONSTRAINT "sender_resource_application_evidence_files_application_id_sender_resource_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."sender_resource_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_resource_application_evidence_files" ADD CONSTRAINT "sender_resource_application_evidence_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_resource_application_evidence_files" ADD CONSTRAINT "sender_resource_application_evidence_files_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_resource_applications" ADD CONSTRAINT "sender_resource_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_resource_applications" ADD CONSTRAINT "sender_resource_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_runs" ADD CONSTRAINT "settlement_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_runs" ADD CONSTRAINT "settlement_runs_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_usage_summaries" ADD CONSTRAINT "settlement_usage_summaries_run_id_settlement_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."settlement_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_usage_summaries" ADD CONSTRAINT "settlement_usage_summaries_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_usage_summaries" ADD CONSTRAINT "settlement_usage_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sender_resources" ADD CONSTRAINT "user_sender_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sender_resources" ADD CONSTRAINT "user_sender_resources_sender_resource_id_sender_resources_id_fk" FOREIGN KEY ("sender_resource_id") REFERENCES "public"."sender_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sender_resources" ADD CONSTRAINT "user_sender_resources_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_billing_ref_unique" ON "billing_accounts" USING btree ("billing_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_owner_unique" ON "billing_accounts" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "billing_accounts_status_idx" ON "billing_accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "external_auth_accounts_provider_account_unique" ON "external_auth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "external_auth_accounts_user_idx" ON "external_auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "external_auth_accounts_user_provider_idx" ON "external_auth_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_resource_application_evidence_files_r2_object_unique" ON "sender_resource_application_evidence_files" USING btree ("r2_bucket","r2_object_key");--> statement-breakpoint
CREATE INDEX "sender_resource_application_evidence_files_application_idx" ON "sender_resource_application_evidence_files" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "sender_resource_application_evidence_files_status_delete_after_idx" ON "sender_resource_application_evidence_files" USING btree ("status","delete_after");--> statement-breakpoint
CREATE INDEX "sender_resource_applications_user_status_idx" ON "sender_resource_applications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "sender_resource_applications_reviewed_by_idx" ON "sender_resource_applications" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "sender_resource_applications_resource_type_idx" ON "sender_resource_applications" USING btree ("resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_resources_resource_ref_unique" ON "sender_resources" USING btree ("resource_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_resources_provider_type_value_unique" ON "sender_resources" USING btree ("provider","type","value");--> statement-breakpoint
CREATE INDEX "sender_resources_type_status_idx" ON "sender_resources" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "settlement_runs_status_idx" ON "settlement_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "settlement_runs_receive_date_idx" ON "settlement_runs" USING btree ("start_receive_date","end_receive_date");--> statement-breakpoint
CREATE INDEX "settlement_runs_requested_by_idx" ON "settlement_runs" USING btree ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_usage_summaries_run_scope_unique" ON "settlement_usage_summaries" USING btree ("run_id","billing_account_id","user_id","channel","usage_type");--> statement-breakpoint
CREATE INDEX "settlement_usage_summaries_billing_account_idx" ON "settlement_usage_summaries" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "settlement_usage_summaries_user_idx" ON "settlement_usage_summaries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sender_resources_user_resource_unique" ON "user_sender_resources" USING btree ("user_id","sender_resource_id");--> statement-breakpoint
CREATE INDEX "user_sender_resources_user_status_idx" ON "user_sender_resources" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_sender_resources_resource_status_idx" ON "user_sender_resources" USING btree ("sender_resource_id","status");--> statement-breakpoint
CREATE INDEX "user_sender_resources_billing_account_idx" ON "user_sender_resources" USING btree ("billing_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_user_ref_unique" ON "users" USING btree ("user_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");