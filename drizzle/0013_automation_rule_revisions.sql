CREATE TABLE "automation_rule_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_rule_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"action" varchar(40) NOT NULL,
	"status_before" "automation_rule_status",
	"status_after" "automation_rule_status",
	"config_snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_snapshot_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_rule_revisions_revision_number_positive" CHECK ("automation_rule_revisions"."revision_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "recipient_mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "condition_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "cooldown_policy_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "validation_snapshot_json" jsonb;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "validated_config_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "last_validated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "automation_rule_revisions" ADD CONSTRAINT "automation_rule_revisions_automation_rule_id_automation_rules_id_fk" FOREIGN KEY ("automation_rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_revisions" ADD CONSTRAINT "automation_rule_revisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rule_revisions_rule_revision_unique" ON "automation_rule_revisions" USING btree ("automation_rule_id","revision_number");--> statement-breakpoint
CREATE INDEX "automation_rule_revisions_rule_history_idx" ON "automation_rule_revisions" USING btree ("automation_rule_id","revision_number");--> statement-breakpoint
CREATE INDEX "automation_rule_revisions_actor_action_idx" ON "automation_rule_revisions" USING btree ("actor_user_id","action","created_at");