CREATE TYPE "public"."limit_increase_request_scope" AS ENUM('monthly', 'daily_channel');--> statement-breakpoint
CREATE TYPE "public"."limit_increase_request_status" AS ENUM('submitted', 'approved', 'rejected', 'canceled');--> statement-breakpoint
CREATE TABLE "limit_increase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "message_send_channel" NOT NULL,
	"limit_scope" "limit_increase_request_scope" NOT NULL,
	"sender_resource_id" uuid,
	"current_limit" integer,
	"requested_limit" integer NOT NULL,
	"reason" varchar(1000),
	"status" "limit_increase_request_status" DEFAULT 'submitted' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_memo" varchar(1000),
	"reject_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "limit_increase_requests_requested_limit_positive" CHECK ("limit_increase_requests"."requested_limit" > 0),
	CONSTRAINT "limit_increase_requests_current_limit_nonnegative" CHECK ("limit_increase_requests"."current_limit" is null or "limit_increase_requests"."current_limit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "limit_increase_requests" ADD CONSTRAINT "limit_increase_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_increase_requests" ADD CONSTRAINT "limit_increase_requests_sender_resource_id_sender_resources_id_fk" FOREIGN KEY ("sender_resource_id") REFERENCES "public"."sender_resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limit_increase_requests" ADD CONSTRAINT "limit_increase_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limit_increase_requests_user_status_idx" ON "limit_increase_requests" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "limit_increase_requests_status_created_idx" ON "limit_increase_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "limit_increase_requests_sender_resource_idx" ON "limit_increase_requests" USING btree ("sender_resource_id");--> statement-breakpoint
CREATE INDEX "limit_increase_requests_reviewed_by_idx" ON "limit_increase_requests" USING btree ("reviewed_by");