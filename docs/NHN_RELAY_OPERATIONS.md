# NHN Relay Operations

This app runs a thin NHN relay server for SMS/LMS/MMS and Kakao AlimTalk. NHN remains the source of truth for delivery, templates, raw content, recipient numbers, and final message results. The local service owns identity, sender-resource authorization, credential injection, grouping keys, settlement summaries, private evidence metadata, and audit records.

## Production Environment

Required browser auth:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

Enable Google login in the Clerk Dashboard social connection settings. The relay
stores the Clerk subject in `external_auth_accounts` and does not store Google
OAuth access tokens, refresh tokens, or raw identity-provider payloads. Publ
PApp token exchange uses the same server-side actor resolver with
`external_auth_accounts.provider = "publ"` and must not persist raw Publ access
tokens, refresh tokens, signed exchange JWTs, or raw identity-provider payloads.

Required database and migration configuration:

```bash
DATABASE_URL=
DATABASE_MIGRATION_URL=
```

`DATABASE_MIGRATION_URL` is optional at runtime but recommended for release
migration jobs. It should point at a server-only role allowed to run reviewed
DDL. If unset, migration commands use `DATABASE_URL`.

Required NHN server-only credentials:

```bash
NHN_SMS_API_BASE_URL=https://sms.api.nhncloudservice.com
NHN_SMS_APP_KEY=
NHN_SMS_SECRET_KEY=
NHN_SMS_WEBHOOK_SIGNATURE=
NHN_KAKAO_BIZMESSAGE_API_BASE_URL=https://kakaotalk-bizmessage.api.nhncloudservice.com
NHN_KAKAO_BIZMESSAGE_APP_KEY=
NHN_KAKAO_BIZMESSAGE_SECRET_KEY=
NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE=
```

Do not expose NHN app keys or secret keys through `NEXT_PUBLIC_*`, route
responses, audit metadata, or client logs.
`NHN_SMS_WEBHOOK_SIGNATURE` must match the static signature configured in the
NHN SMS webhook console. Generate it as a long random secret, for example with
`openssl rand -base64 48`, and do not commit it.
AlimTalk common template sources are server code constants, not environment
variables.
`NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE` must match the static signature
configured in the NHN KakaoTalk Bizmessage webhook console. Generate and store
it with the same handling as the SMS webhook signature.

Optional non-production CLI smoke-test fallback:

```bash
RELAY_DEV_AUTH_HEADER_ENABLED=false
```

This header fallback is ignored in production even if set to `true`.

## Local Storage Boundary

Stored locally:

- Users, billing accounts, sender resources, and user-resource access.
- Sender resource applications and private evidence object metadata.
- Minimal message log ledger rows for one send action, child provider-request
  summaries, cached result counts, sync timestamps, and retention timestamps.
- Failed recipient-number lookup metadata in
  `resultSnapshotJson.failedRecipientNos` on provider-request rows. This sparse
  object is keyed by one-based recipient sequence and stores failed recipients
  only.
- Settlement runs and delivered-count summaries by user, billing account, channel, and usage type.
- Audit logs for sensitive operations and selected provider failures.

Not stored locally:

- Original provider send logs, provider recipient rows, or NHN message result payloads.
- Sent recipient phone numbers, except the failed-only
  `resultSnapshotJson.failedRecipientNos` lookup metadata above.
- Sent message bodies, titles, rendered content, buttons, fallback content, or
  content previews.
- Template parameter values or NHN template source payloads.
- NHN `appKey`, `X-Secret-Key`, or raw server configuration in responses or audit metadata.

Fetched directly from NHN:

- Template catalog and template details.
- Message log recipient pages, selected detail, status lookup, bounded
  `message-results` correction, export, and settlement source rows.
- Raw content for authorized resend.
- CSV export data streamed to the browser.
- Settlement source rows by receive/result date.

## Evidence Retention

Evidence files are private objects. The DB stores object metadata only.

- Approved applications: the server deletes evidence immediately and marks successfully deleted files as `deleted`.
- Rejected applications: the server marks evidence `delete_pending` with `deleteAfter = rejectedAt + 90 days`.
- Worker cleanup: `npm run worker` calls `cleanupExpiredEvidence()` on each interval and deletes due `delete_pending` evidence.

Cleanup settings:

```bash
EVIDENCE_CLEANUP_ENABLED=true
EVIDENCE_CLEANUP_LIMIT=100
WORKER_INTERVAL_MS=60000
```

For R2 deletion, configure all of these server-only variables:

```bash
R2_ENDPOINT_URL=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_EVIDENCE_BUCKET=
```

Production evidence storage fails closed unless those R2 variables are present.
Local file storage is available only outside production by explicitly setting:

```bash
EVIDENCE_STORAGE_DRIVER=local
EVIDENCE_STORAGE_LOCAL_DIR=/private/tmp/messaging-app-evidence
```

If evidence upload fails after an application row is created, the server marks
that application `canceled` instead of leaving it `submitted` without evidence.
If evidence deletion fails during approval or cleanup, the file remains
`delete_pending` so the cleanup worker can retry.

## SMS Bulk Send Worker

SMS bulk send runs are persistent server-side jobs for the existing SMS form.
They split up to 50,000 recipients into provider batches of at most 1,000
recipients. The worker submits batches sequentially: it waits for the provider
acceptance response for one batch, then immediately claims the next eligible
batch. It does not wait for NHN final delivery logs before moving to the next
batch.

Worker settings:

```bash
SMS_BULK_SEND_WORKER_ENABLED=true
SMS_BULK_SEND_MAX_BATCHES_PER_TICK=100
SMS_BULK_PAYLOAD_CLEANUP_LIMIT=100
WORKER_INTERVAL_MS=60000
WORKER_ID=worker-1
```

Operational rules:

- Configure per-user SMS quota buckets before enabling bulk sends for a user.
- `blocked` means a provider timeout, provider rate limit, or uncertain
  provider-call result stopped later batches. Do not auto-retry blocked runs
  because duplicate delivery is possible.
- `acceptedRecipientCount` is provider acceptance progress only. NHN logs remain
  the source of truth for final delivery results.
- Batch payloads contain sensitive recipient/content data and are purged by the
  worker after terminal processing or payload expiry.
- To diagnose a split bulk send from an NHN provider request id, look up
  `sms_bulk_send_batches.provider_request_id`, then follow `run_id` to
  `sms_bulk_send_runs`. The run row contains the actor-owned management title,
  sender resource, request date, and provider-acceptance counts.
- Reservation screens use that same mapping so a run split into multiple NHN
  provider request ids appears as one operational group. Grouped-log screens use
  the local message log ledger and its child request summaries for the same
  one-row-per-run behavior.
- SMS bulk grouping reuses `sms_bulk_send_runs` and `sms_bulk_send_batches`.
  Do not add a separate grouping table for SMS bulk reservations/logs unless
  future non-SMS bulk support requires a provider-neutral run model.
- AlimTalk and Brand Message bulk grouping is future work. Their reservation
  cancel actions remain hidden/rejected in this phase.

## SMS Result Webhook Setup

Configure NHN SMS webhook management before relying on webhook-first result
snapshots.

NHN console settings:

- Event: `메시지 발송 결과 코드 업데이트` / `MESSAGE_RESULT_UPDATE`.
- Target URL:
  `https://{domain}/api/nhn/webhooks/sms`.
- Signature: the same long random value set in
  `NHN_SMS_WEBHOOK_SIGNATURE`.

Required runtime environment:

```bash
NHN_SMS_APP_KEY=
NHN_SMS_SECRET_KEY=
NHN_SMS_WEBHOOK_SIGNATURE=
```

Registration checklist:

- Implement and deploy `POST /api/nhn/webhooks/sms` before registering the
  final URL. Otherwise NHN verification may see `404`, `405`, or signature
  validation failures.
- Use the local tunnel URL only for local testing:
  `https://sms-webhook-dev.vizuo.work/api/nhn/webhooks/sms`.
- Use the staging or production domain URL for deployed testing.
- If registration fails, verify the app is running, the tunnel or deployment
  returns a non-`502` response, the route supports `POST`, and the configured
  signature header is accepted.

Webhook behavior:

- NHN may send one hook or multiple hooks in one POST.
- Hooks may arrive before the local provider-request row is updated. Unmatched
  hooks are accepted without storing raw payloads, and the correction worker
  recovers missed results later.
- The route validates signature, app key, product, and event before processing.
- Webhook payloads, recipient numbers, message content, grouping keys, links,
  and raw provider responses are not stored or logged.

Local tunnel testing:

- NHN cannot reach plain localhost directly. Use a tunnel such as ngrok or
  cloudflared for local webhook testing.
- Current development tunnel hostname prepared during planning:
  `https://sms-webhook-dev.vizuo.work`.
- Tunnel target service: `http://localhost:3000`.
- Final local webhook URL:
  `https://sms-webhook-dev.vizuo.work/api/nhn/webhooks/sms`.
- To smoke test the tunnel, run the local app and verify both:

```bash
curl -i http://localhost:3000
curl -i https://sms-webhook-dev.vizuo.work
```

- Cloudflare `502` means DNS reaches Cloudflare, but the local origin is
  unavailable.
- The Cloudflare connector token was exposed during planning. Rotate it before
  long-running or shared testing.

## Kakao Bizmessage Result Webhook Setup

Configure NHN KakaoTalk Bizmessage webhook management before relying on
webhook-first result snapshots for AlimTalk and Brand Message.

NHN console settings:

- Event: `MESSAGE_RESULT_UPDATE`.
- Target URL:
  `https://{domain}/api/nhn/webhooks/kakao-bizmessage`.
- Signature: the same long random value set in
  `NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE`.

Required runtime environment:

```bash
NHN_KAKAO_BIZMESSAGE_APP_KEY=
NHN_KAKAO_BIZMESSAGE_SECRET_KEY=
NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE=
```

Webhook behavior:

- Webhook is the primary recipient-result update path for AlimTalk and Brand
  Message. Provider lookup/correction is only a fallback for missing, late, or
  unmatched webhooks.
- The route validates signature, app key, `productName === "KakaoTalk
  Bizmessage"`, and `event === "MESSAGE_RESULT_UPDATE"` before processing.
- The documented `X-Toast-Webhook-Signature` header is accepted. The normalized
  `X-Nhn-Webhook-Signature` header is also accepted for parity with the SMS
  receiver. Signature comparison must be constant time.
- In-scope hook message types are `ALIMTALK_NORMAL` and
  `BRAND_MESSAGE_NORMAL`. Auth, mass, and FriendTalk hook types are ignored
  until an explicit send flow adds support.
- Hooks may arrive before the local provider-request row is updated. Unmatched
  hooks are accepted without storing raw payloads, and the correction worker
  recovers missed results later.
- Store only compact snapshot state, bounded provider result code, and failed
  recipient numbers on provider request rows. Webhook payloads, non-failed
  recipient numbers, message content, template variables, buttons, grouping keys,
  provider links, and raw provider responses are not stored or logged.

## Message Log Ledger, Snapshots, And Correction

The top-level 발송기록 list reads local message log ledger rows only. It must not
page through provider recipient rows or provider request pages on list load.
Provider row fetches happen only for status lookup, bounded correction,
selected detail views, recipient pages, export, resend, and settlement source
reads.

Ledger behavior:

- A list row represents one user send action, not one recipient.
- Top-level log channels are `sms`, `alimtalk`, and `brand-message`. The `sms`
  channel includes stored `sms`, `lms`, and `mms` rows; use a secondary message
  type filter for narrower text-message views.
- Do not add an `all` log tab in this phase.
- Do not split basic and bulk sends into separate log tabs. Use badges and
  filters within the channel list.
- `managementTitle` is a bounded operational label only. It may be explicit or
  generated from a safe label such as `SMS 발송`, but it must never be copied
  from message body, title, rendered content, template values, buttons,
  fallback content, or recipient data.
- Accepted sends with pending snapshots display
  `접수 완료 · 결과 집계 중`, not `성공 0명`.
- Ordinary users do not get manual result-sync controls. `새로고침` refetches
  local DB summaries only.

Webhook-first result snapshots:

- SMS/LMS/MMS accepted provider requests initialize compact local snapshots on
  the provider-request row.
- AlimTalk and Brand Message accepted provider requests also initialize compact
  local snapshots on the provider-request row once the provider `requestId` is
  known.
- Kakao Bizmessage snapshot result mapping is `MRC01 -> S`; any other non-empty
  `resultCode -> F`; missing result code means no update. Cancellation maps to
  `C` only when a verified Kakao webhook or lookup field explicitly identifies
  cancellation.
- Snapshot failures drive the failure list without scanning provider recipient
  pages.
- Failed recipient numbers are stored in `resultSnapshotJson.failedRecipientNos`,
  a sparse object keyed by one-based recipient sequence. Webhook, status polling,
  and correction merge paths may set this key only when the effective snapshot
  state is `F`.
- Success, pending, and canceled recipient numbers are not stored in
  `failedRecipientNos`. If an authoritative correction changes a failed sequence
  to success or cancel, the stored failed number for that sequence is removed.
- Phone number and content details are fetched only after a user selects one
  row, through local opaque group/request ids, and are not persisted except for
  the failed-only lookup metadata above.
- Browser DTOs, query keys, URLs, toasts, analytics, and local storage must not
  expose provider request ids for the new failure/detail routes.

Correction worker:

- Correction is a safety net for missing, late, or unmatched webhooks. Webhooks
  remain the primary result path.
- Correction uses NHN SMS API v3.0 `message-results` for SMS/LMS/MMS.
- AlimTalk and Brand Message correction use bounded Kakao Bizmessage
  message-list lookup filtered by the local provider request id and
  server-owned grouping keys.
- Correction must not use `mass-sender`, `/sender/sms`, `/sender/mms`, or
  provider recipient page scans. Kakao Bizmessage correction must not use auth,
  mass, or FriendTalk APIs for the current normal AlimTalk and Brand Message
  send flows.
- SMS, LMS, MMS, AlimTalk, and Brand Message share the same thresholds:
  - 30 minutes after effective send time: merge known results and keep
    unresolved rows pending.
  - 2 hours after effective send time: final correction and result
    finalization.
- Effective send time is `scheduledAt` for scheduled sends, otherwise the
  accepted send or created time.
- The final correction sets `resultFinalizedAt`; if pending results remain, the
  UI shows `집계 마감 · 일부 미확인`.
- Worker logs include safe correction counts only, such as processed,
  corrected, finalized, stale, and error counts.
- Worker logs must not include raw webhook payloads, phone numbers, message
  bodies, grouping keys, or provider responses.

Worker settings:

```bash
MESSAGE_RESULT_CORRECTION_WORKER_ENABLED=true
MESSAGE_RESULT_CORRECTION_LIMIT=20
WORKER_INTERVAL_MS=60000
WORKER_ID=worker-1
```

When provider scans are required, page until the provider result set is
exhausted, then filter by server-owned grouping keys and local ownership. Do not
silently stop at a fixed provider page count. User-facing page sizes remain
limited to 100 rows, and production scans keep a safety budget; if a scan
exceeds it, return `LOCAL_VALIDATION_FAILED` and ask the user to narrow the
range instead of returning truncated data.

## Message Log Retention

- User-visible ledger rows are available for 90 days.
- At 90 days, soft archive ledger rows and hide them from normal list queries.
- Thirty days after archive, hard-delete archived ledger rows and child request
  summaries in batches.
- Archived detail routes return a friendly retention-expired message, for
  example `보관 기간이 지난 발송입니다`, rather than silently pretending the send
  never existed.
- Archived detail and failure routes must return from local state only and must
  not call provider APIs.

## Audit Coverage

Audit records use metadata-only payloads and sanitize recipient/content/template/raw-provider fields.

Covered events:

- `message_logs.exported`
- `sender_resource_application.approved`
- `sender_resource_application.rejected`
- `settlement_run.created`
- `settlement_run.finalized`
- `provider.timeout`
- `provider.rate_limited`
- `local_validation.rejected`
- `evidence_files.cleaned_up`

Provider timeout and rate-limit audits include provider code/message metadata when available, but they do not store raw NHN response bodies or request payloads.

## Provider Errors

Frontend-facing responses use standard relay envelopes. Rate-limit and timeout messages are fixed user-readable messages; provider messages are carried separately as diagnostic fields when NHN provides them. Routes return normalized DTOs and do not expose NHN secrets, raw NHN envelopes, or internal authorization context.

## Verification

Before deploying a schema change, verify generated migrations locally:

```bash
npm run db:migration:verify
npm run db:migration:check
```

Apply reviewed migrations through a release job:

```bash
DATABASE_MIGRATION_URL=postgres://... npm run db:migration:apply
```

Run the full server verification before handoff:

```bash
npm run lint && npm run test:server && npm run build
```

## Smoke Test Procedure

Mock-backed verification does not call NHN:

```bash
npm run harness:test && npm run lint && npm run test:server && npm run build
```

For a local relay smoke test, seed an active user, billing account, SMS sender
resource, and user-resource link. Configure `DATABASE_URL`, NHN credentials, and
R2 variables. In a browser, sign in through Clerk at `/sign-in` and exercise the
send/log screens with the Clerk session cookie.

For CLI-only local smoke tests, run outside production with the explicit fallback
enabled:

```bash
RELAY_DEV_AUTH_HEADER_ENABLED=true npm run dev
curl -X POST http://127.0.0.1:3000/api/messages/sms/send \
  -H "content-type: application/json" \
  -H "x-relay-user-id: user_1" \
  -d '{
    "clientRequestId": "de305d54-75b4-431b-adb2-eb6b9e546014",
    "senderResourceId": "sms_resource_1",
    "body": "Test message",
    "recipients": [{ "recipientNo": "01012345678" }]
  }'
```

Production smoke tests should not use `x-relay-user-id`; use a real Clerk
session and server-side seeded sender resources.
