CREATE UNIQUE INDEX "automation_rules_enabled_event_unique" ON "automation_rules" USING btree ("user_id","event_definition_id") WHERE "automation_rules"."status" = 'enabled';
