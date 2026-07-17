# NHN Relay Server Technical Design

Last reviewed: 2026-06-02

## Purpose

Build a production server that lets users send SMS/LMS/MMS and Kakao AlimTalk through NHN Cloud while keeping this service thin. NHN remains the source of truth for message delivery, logs, templates, and final recipient results. This service owns user identity, sender resource approval, credential protection, authorization filtering, settlement summaries, exports, and operational audit records.

This is not an MVP shortcut. It is the intended production design: avoid duplicating NHN's delivery system unless the application has a clear reason to do so.

## Non-Negotiable Principles

- Use direct NHN product APIs:
  - SMS: `Notification > SMS API v3.0`
  - Kakao: `KakaoTalk Bizmessage API v2.3`
- Do not use Notification Hub APIs for this implementation unless a later task explicitly changes the API line.
- Do not expose NHN `appKey` or `X-Secret-Key` to the browser.
- Do not store original provider message logs or recipient rows in our DB.
- Do not store recipient phone numbers, message bodies, or template parameter values in our DB for sent messages.
- Store only the data needed to decide who can use which sender resource, run settlement summaries, and audit sensitive operations.
- Treat NHN as the authority for templates, send history, final status, raw content, and recipient numbers.

## System Shape

```text
Frontend
  -> Our server
      - authenticate user
      - check sender resource access
      - inject NHN credentials
      - build grouping keys
      - call NHN
      - filter/mask/stream responses
      - store approval, settlement, and audit records only
  -> NHN Cloud
      - sends messages
      - stores message logs
      - returns templates
      - returns delivery results
      - provides raw content for resend/export
```

## Data Boundary

### Store In Our DB

| Area | Data |
| --- | --- |
| Users | `users`, `isOperator`, account status, short immutable `userRef` |
| Billing | `billing_accounts`, short immutable `billingRef`, owner type/id |
| Sender resources | `sender_resources` for SMS send numbers and Kakao sender keys, short immutable `resourceRef`, provider status |
| User-resource access | `user_sender_resources`, role, status, default flag, optional billing override |
| Applications | `sender_resource_applications`, review status, review memo, rejection reason |
| Evidence files | R2 object metadata only; files are private and short-lived |
| Message log ledger | Minimal send-action ledger rows, child provider-request summaries, result counts, and retention timestamps |
| Settlement runs | requested period, status, requested/finalized metadata |
| Settlement summaries | user/billing account/channel delivered counts for a run |
| Audit logs | security-sensitive actions and provider errors without raw recipient/content data |

### Do Not Store In Our DB

- Original provider send logs or provider recipient rows.
- Recipient phone numbers for sent messages.
- Message body or AlimTalk rendered content.
- Template parameter values.
- Message titles, rendered content previews, buttons, fallback content, or recipient row data in the message log ledger.
- NHN message result list payloads.
- NHN template source payloads.
- NHN secret keys in logs or API responses.

### Fetch Directly From NHN

| Feature | NHN source |
| --- | --- |
| Send log list | Local message log ledger |
| Send log detail | NHN single message lookup |
| Send log recipient pages | NHN message list APIs scoped to one provider request |
| Resend raw content | NHN detail lookup, then new raw send |
| Export | NHN list/detail lookup streamed through our server |
| Common templates | NHN sender group templates |
| User templates | NHN sender key templates |
| Final delivery success | NHN message/result codes |
| Settlement source | NHN result/list APIs by receive/result date |

## Core Domain Model

Suggested model names are intentionally provider-neutral where useful, but the first implementation only supports NHN.

### `users`

```text
id
userRef                short immutable public/internal ref for grouping keys
email
name
status
isOperator
createdAt
updatedAt
```

### `billing_accounts`

```text
id
billingRef            short immutable ref for grouping keys
ownerType             user | workspace
ownerId
status
createdAt
updatedAt
```

Initial policy is one user to one billing account. Future team billing can add workspace-owned accounts without changing send/settlement logic.

### `sender_resources`

```text
id
resourceRef           short immutable ref for grouping keys
provider              nhn
type                  sms_send_no | kakao_sender_key
value                 sendNo or senderKey
displayName
status                active | suspended | archived
providerStatus
metadataJson
createdAt
updatedAt
```

The same sender resource may later be connected to multiple users.

### `user_sender_resources`

```text
id
userId
senderResourceId
billingAccountId      optional; default to user's billing account
role                  owner | sender | viewer | auditor
status                pending | active | rejected | suspended
isDefault
createdAt
updatedAt
```

Current read policy: users see only logs they sent, identified by grouping key. Future shared-resource policy can use `role` to allow whole-resource log visibility.

### `sender_resource_applications`

```text
id
userId
resourceType          sms_send_no | kakao_sender_key
requestedValue
status                draft | submitted | approved | rejected | canceled
reviewedBy
reviewedAt
rejectReason
createdAt
updatedAt
```

Use a separate file metadata table or JSON field for evidence files. Files live in private R2.

Evidence retention:

```text
Approved: delete R2 files immediately after approval.
Rejected: keep files for supplementation, then delete after 90 days.
```

### `settlement_runs`

```text
id
startReceiveDate
endReceiveDate
status                running | succeeded | failed | finalized
requestedBy
startedAt
finishedAt
finalizedBy
finalizedAt
errorMessage
createdAt
```

Settlement is manually triggered by an operator or external Publ flow.

### `settlement_usage_summaries`

```text
id
runId
billingAccountId
userId
channel               alimtalk | sms | lms | mms
usageType             direct | fallback | resend | all
deliveredCount
createdAt
```

Settlement billing uses channel totals. `usageType` is useful for later reports, but SMS fallback still counts as SMS for settlement.

### `audit_logs`

```text
id
actorUserId
action
targetType
targetId
metadataJson          no raw recipient/content
ipAddressHash
userAgentSummary
createdAt
```

Audit events include approval/rejection, export, settlement run/finalization, provider timeout, provider rate limit, and local validation rejection.

## Grouping Keys

Because provider recipient rows are not stored locally, every send request must
include NHN grouping keys. These keys are the bridge from NHN logs back to our
user/resource/billing context when a result sync, recipient page, detail, export,
or settlement scan needs to authorize provider data.

SMS and Kakao both support:

```text
senderGroupingKey
recipientGroupingKey
```

SMS grouping keys are limited to 100 characters, so do not concatenate long UUIDs. Store short immutable refs in our DB and build compact keys:

```text
senderGroupingKey = u:{userRef}:b:{billingRef}:r:{resourceRef}:q:{requestRef}
recipientGroupingKey = {senderGroupingKey}:n:{index}
```

`clientRequestId` is generated by the frontend with `crypto.randomUUID()`. The server validates it and derives a short `requestRef` from it. The frontend never sends a grouping key directly.

## Idempotency And Timeout Policy

### AlimTalk

Use `X-NC-API-IDEMPOTENCY-KEY` for AlimTalk sends, derived from user/resource/channel/client request identity. NHN documents duplicate failure when the same key is used within 10 minutes.

Still include grouping keys for log lookup and settlement.

### SMS/LMS/MMS

NHN SMS API v3.0 documentation does not document `X-NC-API-IDEMPOTENCY-KEY` support. Treat SMS as not provider-idempotent.

Policy:

```text
Provider timeout after SMS request
-> do not mark as failed
-> return unknown
-> search NHN logs by grouping key
-> if not found within short UI window, keep unknown
-> require explicit user confirmation before new send because duplicate delivery is possible
```

## SMS Bulk Send Runs

SMS bulk send runs extend the existing SMS send workflow; they are not a
separate campaign product. A run is a persistent server-side submission job for
SMS/LMS/MMS only. AlimTalk, Kakao Bizmessage, Brand Message, advertising
SMS/MMS, and audience expansion are out of scope for this run model until a
later task explicitly adds them.

Direct single-request SMS sending remains limited to 1,000 recipients. The SMS
form may create one bulk run for up to 50,000 concrete recipients. The known
hard API constraint in this app remains 1,000 recipients per provider send
request, so the run must be split into provider batches of at most 1,000
recipients. The local NHN API summary notes a general new-domain request limit
and `429 Too Many Requests` behavior, but it does not document an SMS
per-second batch submission cadence. Do not invent one; sequential batch
submission and provider `429` handling are the safety controls for this phase.

Lifecycle:

```text
create run
-> reserve quota for requested recipient count
-> queue provider batches
-> worker sends batch 1
-> provider acceptance response returns
-> worker immediately sends the next batch
-> completed | blocked | failed | canceled
```

Batch progression means provider acceptance only. The worker must not wait for
NHN final delivery logs before submitting the next batch. If a provider timeout,
provider rate limit, or any `unknown_after_provider_call` result happens, stop
all later batches and mark the run `blocked` with an attention reason. Do not
auto-retry uncertain sends. Provider rejection or local unrecoverable worker
errors mark the run `failed`; user cancellation marks unsent work `canceled`.

Identity:

- Each run has one local run id and one short run ref for the whole send.
- The user-entered management send name is stored as local run metadata.
- Each provider batch has a unique UUID-compatible `clientRequestId` derived
  from `{runRef}:{batchSequence}` and stable across worker restarts.
- Do not reuse the exact same provider-facing id for every batch.
- Provider grouping keys continue to use the existing batch request ref shape;
  local batch rows link those batch refs back to the run ref.
- The frontend never sends grouping keys.

Quota:

- Enforce quota per sender resource before creating the run.
- SMS/LMS/MMS share one KST monthly bucket for each registered sender number.
- Reserve the complete recipient count atomically before the worker starts.
- Provider acceptance keeps quota reserved; only confirmed delivery success
  moves it to consumed.
- Explicit failure/cancellation releases the corresponding reservation. An
  uncertain provider outcome keeps the in-flight batch reserved while later
  unsent batches are released.
- Direct AlimTalk and Brand Message sends use separate KST daily usage buckets
  under one Kakao sender-resource limit. When SMS fallback is enabled, its SMS
  sender quota is reserved in the same pre-provider transaction.
- Webhooks and the existing correction poller settle both primary and fallback
  reservations through the shared message-result snapshot merge path.

Sensitive payload handling:

- The async worker needs enough payload data to send after the HTTP request
  returns. Treat message body, title, sender number, recipient numbers,
  template parameters, request date, stats id, and attachment ids as sensitive
  short-lived payload.
- Store the minimum needed worker payload in server-only storage.
- Never expose worker payload fields through run list/status APIs, audit
  metadata, logs metadata, or browser-visible state.
- Purge each batch payload after terminal batch processing. If the run becomes
  `failed`, `blocked`, or `canceled`, purge remaining unsent payload as part of
  the terminal transition.

Run tables store submission and provider-acceptance progress only. NHN final
delivery logs remain the source of truth for delivery status, recipient-level
results, raw content, and exports.

Bulk reservation and log grouping:

- NHN returns one provider `requestId` per accepted SMS bulk batch. It does not
  return a single provider id for the whole local run.
- `sms_bulk_send_batches.providerRequestId` maps each NHN provider request id
  back to `sms_bulk_send_runs.id` for the actor.
- Scheduled bulk sends are bulk runs with `requestDate`; immediate bulk sends
  are bulk runs without `requestDate`.
- Reservation services first authorize NHN rows, then map SMS/LMS/MMS provider
  request ids back to actor-owned bulk runs. Grouped-log list services read the
  local message log ledger instead.
- Rows mapped to the same local bulk run are grouped internally by that run id
  and exposed through an opaque URL-safe group id. Public ids never expose
  `bulk:{runId}`, grouping keys, provider request id arrays, or sender/date
  heuristics.
- Group summaries may expose `groupType: "bulk_run"`, `bulkRunId`,
  `managementTitle`, `providerRequestCount`, and one
  `representativeRequestId`. They must not expose provider request id arrays,
  worker payloads, recipient numbers, or full message content.
- AlimTalk and Brand Message bulk grouping is future work.

## Message Log Ledger

The 발송기록 list is a local operational ledger, not a provider recipient-row
scan. The list row unit is one user send action. Provider recipient rows are
fetched only for result sync, detail views, recipient pages, status lookup,
resend, export, or settlement source reads.

The ledger must stay minimal and browser-safe. It stores only:

- Local group id and actor user id.
- Channel and sender resource id.
- Send kind: `basic` or `bulk`.
- Send timing: `immediate` or `scheduled`.
- SMS-family message type when the top-level channel is `sms`: `sms`, `lms`, or
  `mms`.
- A bounded `managementTitle`, either explicitly supplied as an operational
  send name or generated as a safe label such as `SMS 발송`.
- Total recipient count.
- Provider request count and accepted request count.
- Provider request ids in child request rows only.
- Provider state and result state.
- Cached aggregate result counts.
- `sentAt`, `scheduledAt`, `createdAt`, `updatedAt`, `lastResultSyncedAt`,
  `resultFinalizedAt`, `archivedAt`, and deletion eligibility timestamps.

The ledger must not store message body, title, template values, phone numbers,
rendered content, content previews, buttons, fallback content, raw provider
payloads, or recipient rows. `managementTitle` must never be copied or derived
from those fields. Explicit management names are trimmed and bounded, reject
control characters, and are accepted only when the caller supplies them as
operational metadata rather than generated message/recipient content.

Top-level channels are:

```text
sms
alimtalk
brand-message
```

The `sms` top-level channel covers stored `sms`, `lms`, and `mms` rows. If the
UI needs narrower filtering inside the SMS tab, use a secondary `messageType`
filter. Do not add an `all` log channel tab in this phase, and do not split
basic and bulk sends into separate top-level tabs. Use badges and filters inside
the selected channel list.

State semantics:

- `providerState` describes whether the provider accepted, rejected, returned
  an unknown result for, or skipped/canceled the send request.
- `resultState` describes whether this service has fetched and aggregated
  recipient delivery results: `not_synced`, `sync_queued`, `syncing`,
  `synced`, `partial`, `failed`, or `finalized`.
- Cached `successCount`, `failedCount`, `pendingCount`, and unresolved counts
  are meaningful only when `resultState` is not `not_synced`.
- `resultFinalizedAt` means automatic result tracking has ended for this
  service. It does not guarantee every recipient reached a success or failure
  state; remaining unresolved recipients stay represented in `pendingCount`.

Scheduled sends use the same ledger shape as immediate sends. Keep one stable
group row from reservation through execution, use `scheduledAt` as the result
sync base time, and do not create a second log group when the scheduled send
executes. Scheduled sends canceled before execution are finalized locally with a
canceled provider/result state and do not enqueue result sync.

Automatic result sync is only for SMS/LMS/MMS bulk ledger rows, including
one-batch bulk rows. AlimTalk, Brand Message, and basic SMS/LMS/MMS sends can be
checked through detail or an explicit result-check action, but they do not get
automatic result sync in this phase.

AlimTalk and Brand Message remain non-bulk in this phase because they do not use
multi-request batching here. Keep `sendKind: "basic"` for those ledger rows and
enforce the existing per-send/request limits plus the daily channel cap for each
channel when accepting sends.

SMS-family bulk result sync schedule:

- Queue checks for send time or scheduled time plus 3 minutes and plus 15
  minutes.
- Run a daily correction pass at 03:30 KST for older bulk sends that still have
  pending results.
- Daily correction starts after 25 hours for SMS and after 80 hours for LMS/MMS.
- After the daily correction threshold, do not keep automatic sync running
  indefinitely. When the final correction checks all child request rows, set
  `resultFinalizedAt` even if some recipients remain pending.
- Result sync endpoints or worker commands may enqueue sync work. They must not
  run heavy recipient scans inside the list route.

Retention:

- User-visible ledger rows are available for 90 days.
- At 90 days, soft archive the ledger row and hide it from normal list queries.
- Thirty days after archive, hard-delete archived ledger rows and child request
  summaries in batches.
- Archived detail routes return a friendly retention-expired message instead of
  pretending the send never existed.

## Validation Boundary

Our server performs only gateway validation:

- User is authenticated.
- User has an active link to the selected sender resource.
- Sender resource type matches channel.
- Request shape is valid JSON.
- Required top-level fields are present.
- Recipient list is non-empty and within NHN's documented limits.
- Phone numbers are clearly plausible.
- `clientRequestId` is valid.
- Fallback SMS is only enabled when the user has an active SMS sender number.

NHN performs domain validation:

- Sender key validity.
- Template approval and parameter compatibility.
- Registered send number validity.
- Kakao channel state.
- Provider-side result codes.
- Fallback result codes.

## API Design

### Sender Resources

```text
GET    /api/sender-resources
POST   /api/sender-resources/sms/applications
POST   /api/sender-resources/kakao/connect/request
POST   /api/sender-resources/kakao/connect/verify
POST   /api/admin/sender-resource-applications/{id}/approve
POST   /api/admin/sender-resource-applications/{id}/reject
```

Kakao connect follows NHN's sender registration and token verification flow. SMS send number applications are manually reviewed by an operator, who uploads required documents to NHN outside this service, then approves or rejects the user application.

### Templates

```text
GET /api/templates/alimtalk?senderResourceId=...
GET /api/templates/sms?senderResourceId=...
GET /api/templates/{channel}/{templateCode}
```

Return approved templates only.

AlimTalk sources:

```text
Common templates: NHN sender group templates
User templates: NHN sender key templates
```

Do not persist template source payloads in our DB. Short server-side response caching is acceptable if needed, but the cache is not a source of truth.

### Sending

```text
POST /api/messages/sms/send
POST /api/messages/alimtalk/send
```

Common send request shape:

```json
{
  "clientRequestId": "frontend-uuid",
  "senderResourceId": "resource-id",
  "templateCode": "template-code",
  "recipients": [],
  "fallback": {
    "enabled": true,
    "smsSenderResourceId": "resource-id"
  }
}
```

Send response states:

```text
accepted_by_provider
rejected_by_provider
unknown_after_provider_call
local_validation_failed
```

Create or update the minimal message log ledger row required by the Message Log
Ledger contract. Do not create local provider recipient rows or persist message
content.

### Send Status And Logs

```text
GET /api/messages/status?channel=&senderResourceId=&clientRequestId=
GET /api/message-logs?channel=&from=&to=&page=&pageSize=
GET /api/message-log-groups?channel=&from=&to=&page=&pageSize=
GET /api/message-log-groups/{groupId}?channel=&from=&to=
GET /api/message-log-groups/{groupId}/requests/{requestLocalId}/recipients?page=&pageSize=
GET /api/message-logs/{channel}/{requestId}/{recipientSeq}
POST /api/message-logs/{channel}/{requestId}/{recipientSeq}/resend
GET /api/message-logs/export?channel=&from=&to=
GET /api/message-reservations?channel=&from=&to=&page=&pageSize=
GET /api/message-reservation-groups/{groupId}?channel=&from=&to=
POST /api/message-reservation-groups/{groupId}/cancel?channel=&from=&to=
```

Provider final delivery logs remain the source of truth for recipient-level
delivery, resend content, exports, and settlement. The top-level `/logs`
experience uses `GET /api/message-log-groups`, which reads only local ledger
rows and child request summaries. It must not fetch provider logs, provider
recipient rows, or provider request pages. Do not use NHN SMS `mass-sender`
lookup APIs for this surface.

List DTO:

```text
id
channel
requestId
recipientSeq
senderLabel
recipientNo
contentPreview
templateCode
requestDate
receiveDate
status
resultCode
resultMessage
```

Details use NHN single lookup and may include full raw content, buttons, quick replies, and recipient number when authorized.
The `/api/message-logs` list, detail, export, and resend endpoints stay
recipient-row APIs for compatibility and row-level workflows.

Grouped list:

- `GET /api/message-log-groups` returns one top-level 발송기록 row per user send
  action from the local message log ledger.
- `channel` is required and must be `sms`, `alimtalk`, or `brand-message`.
- Caller-supplied user, account, billing, grouping-key, or sender-resource
  override filters are ignored or rejected. Authorization is always derived from
  the current actor and local sender-resource ownership.
- The `sms` channel includes ledger rows whose message type is `sms`, `lms`, or
  `mms`; use a secondary `messageType` filter if the UI needs a narrower SMS
  family view.
- The service reads local ledger rows and child request summaries only, sorts
  rows, and then applies pagination.
- `total` is the authorized group count, not the recipient row count.
- Groups sort by latest normalized request date descending, then stable group id
  ascending.
- The group id is an opaque URL-safe local ledger id. It must never expose
  grouping keys, provider request ids, sender/date heuristics, user refs,
  billing refs, resource refs, or request refs.
- Group summaries include only safe summary fields:
  `id`, `channel`, `messageType`, `senderLabel`, `sendKind`, `sendTiming`,
  `managementTitle`, `sentAt`, `scheduledAt`, `totalRecipientCount`,
  `providerState`, `resultState`, `providerRequestCount`,
  `acceptedRequestCount`, `successCount`, `failedCount`, `pendingCount`,
  `lastResultSyncedAt`, `resultFinalizedAt`, and safe action hrefs.
- Group summaries must not include provider request id arrays, recipient
  numbers, full message content, template values, rendered previews, buttons,
  raw grouping keys, `userRef`, `billingRef`, `resourceRef`, `requestRef`, raw
  provider rows, `context`, or `raw`.

Within each group:

- `sentAt` is the accepted immediate send time, when known.
- `scheduledAt` is the reservation send time for scheduled sends.
- `providerRequestCount` is the number of child provider request rows attached
  to the send action.
- Result counts are shown only after `resultState` leaves `not_synced`; accepted
  but unsynced sends should display copy such as `접수 완료 · 결과 미확인` instead
  of `성공 0명`.

Grouped detail:

- `GET /api/message-log-groups/{groupId}` reads the local group row and child
  provider-request summaries. It does not fetch provider recipient rows by
  default.
- The response contains `group` and `requests`.
- `requests` include local request id, display sequence, provider state,
  result state, provider request id only when the detail UI explicitly needs a
  support diagnostic, recipient count, cached result counts, and sync
  timestamps. List rows and query keys must not expose provider request id
  arrays.
- `GET /api/message-log-groups/{groupId}/requests/{requestLocalId}/recipients`
  fetches one provider request page from the provider, authorizes it through the
  current actor and local request summary, and returns public recipient-row DTOs
  without persisting recipient rows.
- Full row content remains available only through
  `GET /api/message-logs/{channel}/{requestId}/{recipientSeq}` after a user
  selects one recipient row.
- Row-level resend remains an individual recipient action from group detail.
- Row-level CSV export remains the existing recipient-row CSV; grouped CSV
  export is out of scope for this phase.

SMS bulk ledger rows may have one or many child provider request rows. A
one-batch bulk send still uses `sendKind: "bulk"` and participates in automatic
result sync. `providerRequestCount > 1` normally indicates more than 1,000
recipients and must be represented through child request rows rather than a
provider request id array on the list DTO.

Reservation groups:

- `GET /api/message-reservations` fetches NHN reservation rows by authorized
  sender resource and date range, then groups after authorization.
- The reservation channel filter is `all | sms | alimtalk | brand-message`.
  SMS includes SMS/LMS/MMS reservations because LMS/MMS are send types, not
  separate reservation tabs.
- SMS bulk reservation rows mapped through
  `sms_bulk_send_batches.providerRequestId` are returned as one group with
  `groupType: "bulk_run"`, `bulkRunId`, `managementTitle`, and
  `providerRequestCount`.
- Public reservation list rows do not expose provider request id arrays.
- `GET /api/message-reservation-groups/{groupId}` and
  `POST /api/message-reservation-groups/{groupId}/cancel` use the opaque
  group id plus the current `channel`, `from`, and `to` filters. The server
  rescans and reauthorizes rows before returning detail or canceling.
- SMS cancel resolves provider request ids internally and cancels only
  cancelable recipients in that group. AlimTalk and Brand Message cancel remain
  rejected until their provider cancel endpoints are confirmed for this app.

Export:

- Server calls NHN.
- Server applies user/resource/grouping-key authorization.
- Stream CSV directly to the browser.
- Original recipient numbers are allowed for authorized exports.
- Record an audit log for every export request.
- R2 is not used for export unless a later large-export task adds async export.

### Settlement

```text
POST /api/admin/settlement-runs
GET  /api/admin/settlement-runs
GET  /api/admin/settlement-runs/{id}
POST /api/admin/settlement-runs/{id}/finalize
```

Request:

```json
{
  "startReceiveDate": "2026-06-01T00:00:00+09:00",
  "endReceiveDate": "2026-06-30T23:59:59+09:00"
}
```

Settlement basis:

```text
receive/result date
NHN successful delivery only
group by user + billing account + channel
```

Success mapping:

```text
AlimTalk: messageStatus = COMPLETED and resultCode = MRC01
SMS/LMS/MMS: msgStatus = 3 and resultCode = 1000
```

Fallback policy:

```text
AlimTalk failed + SMS fallback delivered
=> settlement counts sms 1
```

NHN query ranges must be split to respect product limits. User log screens should limit input to 30 days. Settlement can accept a longer period, but the server must split it into safe NHN query ranges and page through results.

Settlement must run within NHN's log retention window. Current product decision accepts NHN's recent-log retention and will provide export for users who need copies.

## Resend

Resend is an operational action, not business-event replay.

Flow:

```text
User clicks resend on a failed NHN log row
-> server verifies the current user owns or can access the row via grouping key/resource role
-> server fetches NHN detail
-> server uses raw content/recipientNo/buttons from NHN
-> server creates a new clientRequestId/requestRef
-> server sends a new message through NHN
```

Resend always uses a new request identity. Do not reuse the previous idempotency key.

## Error Handling

Return a standard envelope:

```json
{
  "ok": false,
  "error": {
    "source": "relay",
    "code": "LOCAL_VALIDATION_FAILED",
    "message": "수신자 목록은 1명 이상이어야 합니다.",
    "retryable": false
  }
}
```

Provider errors:

```json
{
  "ok": false,
  "error": {
    "source": "nhn",
    "code": "PROVIDER_REJECTED",
    "providerCode": "...",
    "providerMessage": "...",
    "retryable": false
  }
}
```

Core codes:

```text
LOCAL_VALIDATION_FAILED
UNAUTHORIZED
FORBIDDEN
PROVIDER_REJECTED
PROVIDER_TIMEOUT
PROVIDER_RATE_LIMITED
PROVIDER_UNAVAILABLE
RELAY_CONFIG_ERROR
UNKNOWN_AFTER_PROVIDER_CALL
```

Do not expose NHN secrets or raw server config in errors.

## Rate Limits

The direct SMS and Kakao docs should be treated as the authority for their APIs. NHN may still return `429 Too Many Requests`.

Policy:

```text
Send 429: do not auto-retry; return provider rate limited.
Log/detail 429: short backoff and one retry is acceptable.
Settlement 429: exponential backoff; fail the run if exhausted; allow operator rerun.
```

## Security And Privacy

- NHN credentials stay server-side.
- Browser never calls NHN directly.
- Server-side authorization happens before returning NHN log rows.
- Frontend filtering is not a security boundary.
- Audit exports, approvals, rejections, and settlement finalization.
- R2 evidence bucket is private and only served through signed URLs for operators.
- Evidence files:
  - Approved: delete immediately.
  - Rejected: delete after 90 days.
- Sent message recipient/content data is read from NHN only when needed and is not persisted locally.

## Test Strategy

Server work should be tested before frontend E2E exists. Use mock-based server tests for normal development and keep real NHN calls out of CI.

Recommended test layers:

```text
Unit tests:
- grouping key generation and length limits
- clientRequestId validation
- success-code mapping
- relay error envelope mapping
- date-range splitting
- settlement reducers
- resource access checks

NHN client mock tests:
- SMS calls include X-Secret-Key
- AlimTalk calls include X-Secret-Key
- AlimTalk calls include X-NC-API-IDEMPOTENCY-KEY
- SMS does not assume provider idempotency
- senderGroupingKey and recipientGroupingKey are sent
- 429 maps to PROVIDER_RATE_LIMITED
- timeout maps to PROVIDER_TIMEOUT / unknown-after-provider-call behavior

Route integration tests:
- unauthorized senderResourceId returns 403
- pending/rejected sender resources cannot send
- active sender resources call the NHN client
- fallback cannot be enabled without active SMS sender resource
- log proxy filters NHN rows server-side
- export writes audit logs

Negative persistence tests:
- send APIs do not create local send-log rows
- recipientNo/content/template parameter values are not stored in audit or settlement tables

Settlement tests:
- receiveDate/resultDate is the basis
- only delivered rows count
- AlimTalk COMPLETED + MRC01 counts
- SMS msgStatus 3 + resultCode 1000 counts
- fallback SMS success counts as SMS
```

Use Vitest for server unit/integration/mock tests unless a later step identifies a better JavaScript ESM-compatible runner. Add a script:

```bash
npm run test:server
```

Real NHN smoke tests should be opt-in and excluded from normal acceptance:

```text
NHN_SMOKE_ENABLED=true
NHN_SMOKE_SEND_ENABLED=true
NHN_SMOKE_RECIPIENT_NO=...
```

Smoke tests may check:

```text
template list
sender number list
kakao sender lookup
single test send when explicitly enabled
message log lookup
```

Frontend E2E should be added later with Playwright after the server APIs and UI flows exist.

## Implementation Plan Summary

Use harness phase `1-nhn-relay-server`.

## Subagent Orchestration

The harness should run steps sequentially, but each step may use subagents for read-only research and review. This keeps the main implementation context small while still checking provider details and security assumptions.

Rules:

- The main agent owns file edits and final integration.
- Subagents are for read-only investigation, API/documentation verification, codebase reconnaissance, and review.
- Subagents must not edit files unless a step explicitly says otherwise.
- Subagent findings should be summarized before implementation decisions are made.
- Do not let multiple agents concurrently edit shared files such as schema, NHN clients, auth helpers, or route modules.
- For provider uncertainty, prefer official NHN docs and existing local `nhn-notification` reference code over assumptions.

Good subagent uses:

```text
NHN SMS field/idempotency verification
NHN AlimTalk grouping key and result-code verification
Existing nhn-notification reference review
Security/privacy review of export and log proxy behavior
Settlement aggregation edge-case review
Final no-local-log-persistence audit
```

Poor subagent uses:

```text
Parallel edits to the same DB schema
Parallel edits to shared NHN client wrappers
Parallel route implementation without a merge owner
Independent changes that introduce alternate data models
```

Step order:

1. Server foundation: environment, NHN client wrappers, grouping key helpers, error envelope.
2. Domain schema: users, billing accounts, sender resources, applications, settlement, audit.
3. Sender resource approval: SMS application, Kakao connect, operator approval/rejection, R2 lifecycle.
4. NHN resource catalog: approved sender resources and approved template lookup from NHN.
5. Send relay: SMS and AlimTalk send APIs with validation, grouping keys, timeout policy.
6. Log proxy: list/detail/status/resend/export through NHN without local log persistence.
7. Settlement aggregation: operator-triggered receive-date successful delivery summaries.
8. Operational hardening: audit coverage, retention cleanup, docs, final verification.

Every harness step must pass after Step 0 introduces the server test runner:

```bash
npm run lint && npm run test:server && npm run build
```
