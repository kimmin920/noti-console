UPDATE "sender_resources"
SET "display_name" = NULL
WHERE "type" = 'sms_send_no'
  AND "display_name" IS NOT NULL;--> statement-breakpoint

WITH single_active_sms_sender AS (
  SELECT
    "user_sender_resources"."user_id",
    (ARRAY_AGG("user_sender_resources"."id"))[1] AS "link_id"
  FROM "user_sender_resources"
  INNER JOIN "sender_resources"
    ON "user_sender_resources"."sender_resource_id" = "sender_resources"."id"
  WHERE "user_sender_resources"."status" = 'active'
    AND "sender_resources"."status" = 'active'
    AND "sender_resources"."type" = 'sms_send_no'
  GROUP BY "user_sender_resources"."user_id"
  HAVING COUNT(*) = 1
)
UPDATE "user_sender_resources"
SET "is_default" = TRUE
FROM "single_active_sms_sender"
WHERE "user_sender_resources"."id" = "single_active_sms_sender"."link_id"
  AND "user_sender_resources"."is_default" = FALSE;
