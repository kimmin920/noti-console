CREATE TABLE "publ_event_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" varchar(160) NOT NULL,
	"event_type" varchar(40) DEFAULT 'publ-event' NOT NULL,
	"display_name" varchar(160),
	"category" varchar(120),
	"service_status" varchar(40),
	"location_type" varchar(80),
	"location_id" varchar(80),
	"source_type" varchar(80),
	"action_type" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publ_event_definitions_event_type_check" CHECK ("publ_event_definitions"."event_type" = 'publ-event')
);
--> statement-breakpoint
CREATE TABLE "publ_event_prop_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"raw_path" varchar(255),
	"alias" varchar(120) NOT NULL,
	"label" varchar(160),
	"prop_type" varchar(40) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"fallback" varchar(500),
	"parser_pipeline_json" jsonb,
	"description" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publ_event_prop_definitions_prop_type_check" CHECK ("publ_event_prop_definitions"."prop_type" in ('text', 'number', 'datetime', 'enum', 'array'))
);
--> statement-breakpoint
ALTER TABLE "publ_event_prop_definitions" ADD CONSTRAINT "publ_event_prop_definitions_event_id_publ_event_definitions_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."publ_event_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publ_event_definitions_event_key_unique" ON "publ_event_definitions" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "publ_event_definitions_event_type_service_status_idx" ON "publ_event_definitions" USING btree ("event_type","service_status");--> statement-breakpoint
CREATE UNIQUE INDEX "publ_event_prop_definitions_event_alias_unique" ON "publ_event_prop_definitions" USING btree ("event_id","alias");--> statement-breakpoint
CREATE UNIQUE INDEX "publ_event_prop_definitions_event_sort_order_unique" ON "publ_event_prop_definitions" USING btree ("event_id","sort_order");--> statement-breakpoint
CREATE INDEX "publ_event_prop_definitions_event_enabled_idx" ON "publ_event_prop_definitions" USING btree ("event_id","enabled");