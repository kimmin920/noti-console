CREATE TABLE "publ_papp_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consumer_id" varchar(255) NOT NULL,
	"p_app_code" varchar(80) NOT NULL,
	"channel_id" bigint,
	"channel_code" varchar(160) NOT NULL,
	"installed_p_app_id" bigint,
	"seller_profile_distinct_id" varchar(255),
	"seller_role" varchar(80),
	"refresh_token_hash" varchar(128) NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"access_token_jti" varchar(128) NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publ_papp_sessions" ADD CONSTRAINT "publ_papp_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publ_papp_sessions_consumer_id_unique" ON "publ_papp_sessions" USING btree ("consumer_id");--> statement-breakpoint
CREATE INDEX "publ_papp_sessions_user_idx" ON "publ_papp_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "publ_papp_sessions_refresh_lookup_idx" ON "publ_papp_sessions" USING btree ("consumer_id","refresh_token_hash","revoked_at","refresh_token_expires_at");--> statement-breakpoint
CREATE INDEX "publ_papp_sessions_expiry_revocation_idx" ON "publ_papp_sessions" USING btree ("revoked_at","refresh_token_expires_at");