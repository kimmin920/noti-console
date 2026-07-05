CREATE TYPE "public"."automation_event_delivery_status" AS ENUM('processing', 'sent', 'unsent', 'dismissed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."automation_rule_status" AS ENUM('enabled', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."message_send_source_type" AS ENUM('manual', 'automation');--> statement-breakpoint
CREATE TYPE "public"."publ_channel_mapping_status" AS ENUM('active', 'disabled', 'archived');--> statement-breakpoint
CREATE TABLE "automation_event_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_mapping_id" uuid NOT NULL,
	"automation_rule_id" uuid NOT NULL,
	"event_definition_id" uuid NOT NULL,
	"external_event_id" varchar(255) NOT NULL,
	"event_key" varchar(160) NOT NULL,
	"channel_code" varchar(160) NOT NULL,
	"send_channel" "message_send_channel" NOT NULL,
	"status" "automation_event_delivery_status" DEFAULT 'processing' NOT NULL,
	"reason_code" varchar(120),
	"reason_message" varchar(500),
	"target_phone_masked" varchar(80),
	"target_ref_hash" varchar(128),
	"event_payload_ciphertext" text,
	"event_payload_iv" varchar(64),
	"event_payload_tag" varchar(64),
	"event_payload_version" integer DEFAULT 1 NOT NULL,
	"payload_expires_at" timestamp with time zone,
	"payload_purged_at" timestamp with time zone,
	"message_send_group_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_event_deliveries_payload_version_positive" CHECK ("automation_event_deliveries"."event_payload_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_definition_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" "automation_rule_status" DEFAULT 'disabled' NOT NULL,
	"send_channel" "message_send_channel" NOT NULL,
	"sender_resource_id" uuid NOT NULL,
	"template_code" varchar(160) NOT NULL,
	"template_source" varchar(80),
	"variable_mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publ_channel_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_code" varchar(160) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"status" "publ_channel_mapping_status" DEFAULT 'active' NOT NULL,
	"external_business_ref" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD COLUMN "source_type" "message_send_source_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD COLUMN "source_event_key" varchar(160);--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD COLUMN "source_external_event_id" varchar(255);--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD COLUMN "source_channel_code" varchar(160);--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD COLUMN "source_automation_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD COLUMN "source_automation_delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "automation_event_deliveries" ADD CONSTRAINT "automation_event_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_event_deliveries" ADD CONSTRAINT "automation_event_deliveries_channel_mapping_id_publ_channel_mappings_id_fk" FOREIGN KEY ("channel_mapping_id") REFERENCES "public"."publ_channel_mappings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_event_deliveries" ADD CONSTRAINT "automation_event_deliveries_automation_rule_id_automation_rules_id_fk" FOREIGN KEY ("automation_rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_event_deliveries" ADD CONSTRAINT "automation_event_deliveries_event_definition_id_publ_event_definitions_id_fk" FOREIGN KEY ("event_definition_id") REFERENCES "public"."publ_event_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_event_deliveries" ADD CONSTRAINT "automation_event_deliveries_message_send_group_id_message_send_groups_id_fk" FOREIGN KEY ("message_send_group_id") REFERENCES "public"."message_send_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_event_definition_id_publ_event_definitions_id_fk" FOREIGN KEY ("event_definition_id") REFERENCES "public"."publ_event_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_sender_resource_id_sender_resources_id_fk" FOREIGN KEY ("sender_resource_id") REFERENCES "public"."sender_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publ_channel_mappings" ADD CONSTRAINT "publ_channel_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_event_deliveries_delivery_unique" ON "automation_event_deliveries" USING btree ("channel_mapping_id","external_event_id","automation_rule_id");--> statement-breakpoint
CREATE INDEX "automation_event_deliveries_user_status_created_idx" ON "automation_event_deliveries" USING btree ("user_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "automation_event_deliveries_payload_purge_idx" ON "automation_event_deliveries" USING btree ("payload_expires_at","payload_purged_at");--> statement-breakpoint
CREATE INDEX "automation_event_deliveries_message_send_group_idx" ON "automation_event_deliveries" USING btree ("message_send_group_id");--> statement-breakpoint
CREATE INDEX "automation_rules_lookup_idx" ON "automation_rules" USING btree ("user_id","event_definition_id","status");--> statement-breakpoint
CREATE INDEX "automation_rules_user_status_idx" ON "automation_rules" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "automation_rules_sender_resource_idx" ON "automation_rules" USING btree ("sender_resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publ_channel_mappings_channel_code_unique" ON "publ_channel_mappings" USING btree ("channel_code");--> statement-breakpoint
CREATE INDEX "publ_channel_mappings_user_status_idx" ON "publ_channel_mappings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "publ_channel_mappings_status_idx" ON "publ_channel_mappings" USING btree ("status");--> statement-breakpoint
ALTER TABLE "message_send_groups" ADD CONSTRAINT "message_send_groups_source_automation_rule_id_automation_rules_id_fk" FOREIGN KEY ("source_automation_rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_send_groups_automation_source_lookup_idx" ON "message_send_groups" USING btree ("source_type","source_channel_code","source_external_event_id","source_automation_rule_id","source_automation_delivery_id");
