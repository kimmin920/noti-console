CREATE TYPE "public"."sender_resource_quota_channel" AS ENUM('sms', 'alimtalk', 'brand-message');--> statement-breakpoint
CREATE TYPE "public"."sender_resource_quota_reservation_kind" AS ENUM('primary', 'fallback');--> statement-breakpoint
CREATE TABLE "sender_resource_quota_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_resource_id" uuid NOT NULL,
	"quota_channel" "sender_resource_quota_channel" NOT NULL,
	"period_start_at" timestamp with time zone NOT NULL,
	"period_end_at" timestamp with time zone NOT NULL,
	"quota_limit" integer NOT NULL,
	"reserved_count" integer DEFAULT 0 NOT NULL,
	"consumed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sender_resource_quota_buckets_period_valid" CHECK ("sender_resource_quota_buckets"."period_end_at" > "sender_resource_quota_buckets"."period_start_at"),
	CONSTRAINT "sender_resource_quota_buckets_limit_positive" CHECK ("sender_resource_quota_buckets"."quota_limit" > 0),
	CONSTRAINT "sender_resource_quota_buckets_reserved_nonnegative" CHECK ("sender_resource_quota_buckets"."reserved_count" >= 0),
	CONSTRAINT "sender_resource_quota_buckets_consumed_nonnegative" CHECK ("sender_resource_quota_buckets"."consumed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sender_resource_quota_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_id" uuid NOT NULL,
	"provider_request_id" uuid,
	"kind" "sender_resource_quota_reservation_kind" NOT NULL,
	"reserved_count" integer NOT NULL,
	"consumed_count" integer DEFAULT 0 NOT NULL,
	"released_count" integer DEFAULT 0 NOT NULL,
	"settlement_snapshot_json" jsonb,
	"fallback_opened_at" timestamp with time zone,
	"result_synced_at" timestamp with time zone,
	"result_finalized_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sender_resource_quota_reservations_reserved_positive" CHECK ("sender_resource_quota_reservations"."reserved_count" > 0),
	CONSTRAINT "sender_resource_quota_reservations_consumed_nonnegative" CHECK ("sender_resource_quota_reservations"."consumed_count" >= 0),
	CONSTRAINT "sender_resource_quota_reservations_released_nonnegative" CHECK ("sender_resource_quota_reservations"."released_count" >= 0),
	CONSTRAINT "sender_resource_quota_reservations_settlement_lte_reserved" CHECK ("sender_resource_quota_reservations"."consumed_count" + "sender_resource_quota_reservations"."released_count" <= "sender_resource_quota_reservations"."reserved_count")
);
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "message_send_provider_requests"
		GROUP BY "client_request_id"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot create message_send_provider_requests_client_request_unique: duplicate client_request_id rows exist';
	END IF;
END $$;--> statement-breakpoint
DROP INDEX "message_send_provider_requests_client_request_idx";--> statement-breakpoint
ALTER TABLE "sender_resource_quota_buckets" ADD CONSTRAINT "sender_resource_quota_buckets_sender_resource_id_sender_resources_id_fk" FOREIGN KEY ("sender_resource_id") REFERENCES "public"."sender_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_resource_quota_reservations" ADD CONSTRAINT "sender_resource_quota_reservations_bucket_id_sender_resource_quota_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."sender_resource_quota_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_resource_quota_reservations" ADD CONSTRAINT "sender_resource_quota_reservations_provider_request_id_message_send_provider_requests_id_fk" FOREIGN KEY ("provider_request_id") REFERENCES "public"."message_send_provider_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sender_resource_quota_buckets_period_unique" ON "sender_resource_quota_buckets" USING btree ("sender_resource_id","quota_channel","period_start_at","period_end_at");--> statement-breakpoint
CREATE INDEX "sender_resource_quota_buckets_lookup_idx" ON "sender_resource_quota_buckets" USING btree ("sender_resource_id","quota_channel","period_end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_resource_quota_reservations_request_kind_unique" ON "sender_resource_quota_reservations" USING btree ("provider_request_id","kind") WHERE "sender_resource_quota_reservations"."provider_request_id" is not null;--> statement-breakpoint
CREATE INDEX "sender_resource_quota_reservations_bucket_idx" ON "sender_resource_quota_reservations" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "sender_resource_quota_reservations_request_idx" ON "sender_resource_quota_reservations" USING btree ("provider_request_id");--> statement-breakpoint
CREATE INDEX "sender_resource_quota_reservations_fallback_sync_idx" ON "sender_resource_quota_reservations" USING btree ("kind","result_finalized_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_send_provider_requests_client_request_unique" ON "message_send_provider_requests" USING btree ("client_request_id");
