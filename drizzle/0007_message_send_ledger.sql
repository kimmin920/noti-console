CREATE TYPE "public"."message_send_channel" AS ENUM('sms', 'lms', 'mms', 'alimtalk', 'brand-message');--> statement-breakpoint
CREATE TYPE "public"."message_send_kind" AS ENUM('basic', 'bulk');--> statement-breakpoint
CREATE TYPE "public"."message_send_provider_state" AS ENUM('queued', 'sending', 'accepted', 'partial', 'rejected', 'unknown', 'failed', 'blocked', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."message_send_result_state" AS ENUM('not_synced', 'syncing', 'partially_synced', 'synced', 'stale', 'error');--> statement-breakpoint
CREATE TYPE "public"."message_send_timing" AS ENUM('immediate', 'scheduled');--> statement-breakpoint
CREATE TABLE "message_send_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sender_resource_id" uuid NOT NULL,
	"billing_account_id" uuid,
	"channel" "message_send_channel" NOT NULL,
	"send_kind" "message_send_kind" DEFAULT 'basic' NOT NULL,
	"send_timing" "message_send_timing" DEFAULT 'immediate' NOT NULL,
	"management_title" varchar(160) NOT NULL,
	"total_recipient_count" integer NOT NULL,
	"provider_request_count" integer DEFAULT 0 NOT NULL,
	"accepted_request_count" integer DEFAULT 0 NOT NULL,
	"provider_state" "message_send_provider_state" DEFAULT 'queued' NOT NULL,
	"result_state" "message_send_result_state" DEFAULT 'not_synced' NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"pending_count" integer DEFAULT 0 NOT NULL,
	"canceled_count" integer DEFAULT 0 NOT NULL,
	"result_synced_at" timestamp with time zone,
	"result_finalized_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	"archive_reason" varchar(120),
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_send_groups_total_recipient_count_nonnegative" CHECK ("message_send_groups"."total_recipient_count" >= 0),
	CONSTRAINT "message_send_groups_provider_request_count_nonnegative" CHECK ("message_send_groups"."provider_request_count" >= 0),
	CONSTRAINT "message_send_groups_accepted_request_count_nonnegative" CHECK ("message_send_groups"."accepted_request_count" >= 0),
	CONSTRAINT "message_send_groups_accepted_request_count_lte_provider_request_count" CHECK ("message_send_groups"."accepted_request_count" <= "message_send_groups"."provider_request_count"),
	CONSTRAINT "message_send_groups_success_count_nonnegative" CHECK ("message_send_groups"."success_count" >= 0),
	CONSTRAINT "message_send_groups_failed_count_nonnegative" CHECK ("message_send_groups"."failed_count" >= 0),
	CONSTRAINT "message_send_groups_pending_count_nonnegative" CHECK ("message_send_groups"."pending_count" >= 0),
	CONSTRAINT "message_send_groups_canceled_count_nonnegative" CHECK ("message_send_groups"."canceled_count" >= 0),
	CONSTRAINT "message_send_groups_result_counts_lte_total_recipient_count" CHECK ("message_send_groups"."success_count" + "message_send_groups"."failed_count" + "message_send_groups"."pending_count" + "message_send_groups"."canceled_count" <= "message_send_groups"."total_recipient_count")
);
--> statement-breakpoint
CREATE TABLE "message_send_provider_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"client_request_id" uuid NOT NULL,
	"provider_request_id" varchar(128),
	"recipient_count" integer NOT NULL,
	"provider_state" "message_send_provider_state" DEFAULT 'queued' NOT NULL,
	"result_state" "message_send_result_state" DEFAULT 'not_synced' NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"pending_count" integer DEFAULT 0 NOT NULL,
	"canceled_count" integer DEFAULT 0 NOT NULL,
	"result_synced_at" timestamp with time zone,
	"result_finalized_at" timestamp with time zone,
	"sync_locked_by" varchar(120),
	"sync_lease_expires_at" timestamp with time zone,
	"sync_attempts" integer DEFAULT 0 NOT NULL,
	"next_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_send_provider_requests_sequence_positive" CHECK ("message_send_provider_requests"."sequence" > 0),
	CONSTRAINT "message_send_provider_requests_recipient_count_nonnegative" CHECK ("message_send_provider_requests"."recipient_count" >= 0),
	CONSTRAINT "message_send_provider_requests_success_count_nonnegative" CHECK ("message_send_provider_requests"."success_count" >= 0),
	CONSTRAINT "message_send_provider_requests_failed_count_nonnegative" CHECK ("message_send_provider_requests"."failed_count" >= 0),
	CONSTRAINT "message_send_provider_requests_pending_count_nonnegative" CHECK ("message_send_provider_requests"."pending_count" >= 0),
	CONSTRAINT "message_send_provider_requests_canceled_count_nonnegative" CHECK ("message_send_provider_requests"."canceled_count" >= 0),
	CONSTRAINT "message_send_provider_requests_sync_attempts_nonnegative" CHECK ("message_send_provider_requests"."sync_attempts" >= 0),
	CONSTRAINT "message_send_provider_requests_result_counts_lte_recipient_count" CHECK ("message_send_provider_requests"."success_count" + "message_send_provider_requests"."failed_count" + "message_send_provider_requests"."pending_count" + "message_send_provider_requests"."canceled_count" <= "message_send_provider_requests"."recipient_count")
);
--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD CONSTRAINT "message_send_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD CONSTRAINT "message_send_groups_sender_resource_id_sender_resources_id_fk" FOREIGN KEY ("sender_resource_id") REFERENCES "public"."sender_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD CONSTRAINT "message_send_groups_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_send_provider_requests" ADD CONSTRAINT "message_send_provider_requests_group_id_message_send_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."message_send_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_send_groups_user_channel_active_created_idx" ON "message_send_groups" USING btree ("user_id","channel","archived_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_send_groups_user_expires_at_idx" ON "message_send_groups" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "message_send_groups_purge_after_archived_idx" ON "message_send_groups" USING btree ("purge_after","archived_at");--> statement-breakpoint
CREATE INDEX "message_send_groups_sync_scope_idx" ON "message_send_groups" USING btree ("send_kind","channel","result_state","result_finalized_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_send_provider_requests_group_sequence_unique" ON "message_send_provider_requests" USING btree ("group_id","sequence");--> statement-breakpoint
CREATE INDEX "message_send_provider_requests_client_request_idx" ON "message_send_provider_requests" USING btree ("client_request_id");--> statement-breakpoint
CREATE INDEX "message_send_provider_requests_provider_request_idx" ON "message_send_provider_requests" USING btree ("provider_request_id");--> statement-breakpoint
CREATE INDEX "message_send_provider_requests_group_sequence_idx" ON "message_send_provider_requests" USING btree ("group_id","sequence");--> statement-breakpoint
CREATE INDEX "message_send_provider_requests_sync_claim_idx" ON "message_send_provider_requests" USING btree ("result_state","next_sync_at","sync_lease_expires_at");