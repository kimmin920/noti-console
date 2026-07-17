ALTER TYPE "public"."sms_quota_scope" ADD VALUE 'sender_resource_period';--> statement-breakpoint
DROP INDEX "sms_quota_buckets_scope_unique";--> statement-breakpoint
ALTER TABLE "sender_resources" ADD COLUMN "quota_limit" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_quota_buckets" ADD COLUMN "sender_resource_id" uuid;--> statement-breakpoint
WITH "single_sender_resource" AS (
	SELECT
		"sms_quota_reservations"."bucket_id",
		MIN("sms_bulk_send_runs"."sender_resource_id"::text)::uuid AS "sender_resource_id"
	FROM "sms_quota_reservations"
	INNER JOIN "sms_bulk_send_runs"
		ON "sms_quota_reservations"."run_id" = "sms_bulk_send_runs"."id"
	GROUP BY "sms_quota_reservations"."bucket_id"
	HAVING COUNT(DISTINCT "sms_bulk_send_runs"."sender_resource_id") = 1
)
UPDATE "sms_quota_buckets"
SET "sender_resource_id" = "single_sender_resource"."sender_resource_id"
FROM "single_sender_resource"
WHERE "sms_quota_buckets"."id" = "single_sender_resource"."bucket_id";--> statement-breakpoint
WITH "single_sms_resource" AS (
	SELECT
		"user_sender_resources"."user_id",
		MIN("user_sender_resources"."sender_resource_id"::text)::uuid AS "sender_resource_id"
	FROM "user_sender_resources"
	INNER JOIN "sender_resources"
		ON "user_sender_resources"."sender_resource_id" = "sender_resources"."id"
	WHERE "user_sender_resources"."status" = 'active'
		AND "sender_resources"."status" = 'active'
		AND "sender_resources"."type" = 'sms_send_no'
	GROUP BY "user_sender_resources"."user_id"
	HAVING COUNT(DISTINCT "user_sender_resources"."sender_resource_id") = 1
)
UPDATE "limit_increase_requests"
SET "sender_resource_id" = "single_sms_resource"."sender_resource_id"
FROM "single_sms_resource"
WHERE "limit_increase_requests"."user_id" = "single_sms_resource"."user_id"
	AND "limit_increase_requests"."channel" = 'sms'
	AND "limit_increase_requests"."sender_resource_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sms_quota_buckets" ADD CONSTRAINT "sms_quota_buckets_sender_resource_id_sender_resources_id_fk" FOREIGN KEY ("sender_resource_id") REFERENCES "public"."sender_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_quota_buckets_sender_resource_lookup_idx" ON "sms_quota_buckets" USING btree ("sender_resource_id","quota_scope","period_end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_quota_buckets_scope_unique" ON "sms_quota_buckets" USING btree ("sender_resource_id","channel","quota_scope","period_start_at","period_end_at");--> statement-breakpoint
ALTER TABLE "sender_resources" ADD CONSTRAINT "sender_resources_quota_limit_positive" CHECK ("sender_resources"."quota_limit" > 0);
