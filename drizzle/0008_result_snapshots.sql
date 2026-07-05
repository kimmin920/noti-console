ALTER TABLE "message_send_provider_requests" ADD COLUMN "result_snapshot_json" jsonb;--> statement-breakpoint
ALTER TABLE "message_send_provider_requests" ADD COLUMN "result_snapshot_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "message_send_provider_requests" ADD COLUMN "first_result_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message_send_provider_requests" ADD CONSTRAINT "message_send_provider_requests_result_snapshot_version_nonnegative" CHECK ("message_send_provider_requests"."result_snapshot_version" >= 0);