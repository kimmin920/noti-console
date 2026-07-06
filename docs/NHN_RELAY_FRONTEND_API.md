# NHN Relay Frontend API

This document is the frontend-facing contract for the NHN relay server. It is
intended for frontend implementation work, not for database or provider-client
maintenance.

The relay is intentionally thin: NHN remains the source of truth for message
delivery, message logs, raw content, recipient numbers, template source payloads,
and final provider results. The frontend should treat this service as an access
controlled proxy plus send orchestration layer.

## Common Rules

Base URL in local development:

```text
http://127.0.0.1:3000
```

Authentication:

Browser requests authenticate with the Clerk session established by `/sign-in`
or `/sign-up`. The relay maps the Clerk user id to a local `users.id` through
`external_auth_accounts.provider = "clerk"` and continues to authorize against
local sender-resource roles.

Google login is enabled as a Clerk social connection; the browser still talks to
this relay with the normal Clerk session cookie, not with a Google token. If a
Clerk-authenticated email already belongs to an unmapped local account, the
relay returns an authorization error and requires an operator-controlled account
link rather than linking by email automatically.

Publ PApp token exchange plugs into the same server-side actor resolver and
creates an `external_auth_accounts.provider = "publ"` mapping to a local user.
Raw Publ access tokens, refresh tokens, signed exchange assertions, and raw
identity-provider payloads must not be stored in the relay database, audit logs,
or durable browser-visible state.

Admin endpoints additionally require the mapped local user to be an operator.
For local CLI smoke tests only, non-production servers may opt in to the
`x-relay-user-id` fallback by setting `RELAY_DEV_AUTH_HEADER_ENABLED=true`.
That fallback is disabled by default, ignored when a real Clerk session is
available, and never accepted in production.

JSON endpoints return this success envelope:

```json
{
  "ok": true,
  "data": {}
}
```

JSON endpoints return this error envelope:

```json
{
  "ok": false,
  "error": {
    "source": "relay",
    "code": "LOCAL_VALIDATION_FAILED",
    "message": "body is required.",
    "retryable": false,
    "state": "local_validation_failed"
  }
}
```

`source` is usually `relay` or `nhn`.

Known error codes:

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

Send states:

```text
accepted_by_provider
rejected_by_provider
unknown_after_provider_call
local_validation_failed
```

Log status lookup states:

```text
found
unknown
```

Channels:

```text
alimtalk
brand-message
sms
lms
mms
```

Sender resource types:

```text
sms_send_no
kakao_sender_key
```

## Data Handling Boundary

Do not persist these in frontend-owned durable storage, analytics, telemetry, or
client-side audit logs:

- Sent message bodies.
- Rendered AlimTalk content.
- Template parameter values.
- Recipient phone numbers.
- NHN raw provider payloads.
- Provider grouping keys.
- NHN app keys or secret keys.

The log/detail/export endpoints may return recipient/content values fetched
directly from NHN for authorized display or download. Display them only for the
current user workflow. Do not copy them into app-owned logs or local durable
state.

The frontend should never send `senderGroupingKey` or `recipientGroupingKey`.
If supplied, send endpoints replace them with server-owned values.

## Frontend Workflow Map

Message send screen:

- `GET /api/sender-resources`
- `GET /api/templates/sms?senderResourceId=...`
- `POST /api/templates/sms`
- `POST /api/templates/sms/attachments`
- `GET /api/templates/alimtalk?senderResourceId=...`
- `GET /api/templates/{channel}/{templateCode}?senderResourceId=...`
- `POST /api/messages/sms/send`
- `POST /api/messages/alimtalk/send`
- `GET /api/messages/status`

Logs screen:

- `GET /api/message-logs`
- `GET /api/message-log-groups`
- `GET /api/message-log-groups/{groupId}`
- `GET /api/message-log-groups/{groupId}/requests/{requestLocalId}/recipients`
- `GET /api/message-logs/{channel}/{requestId}/{recipientSeq}`
- `POST /api/message-logs/{channel}/{requestId}/{recipientSeq}/resend`
- `GET /api/message-logs/export`

Reservations screen:

- `GET /api/message-reservations`
- `GET /api/message-reservation-groups/{groupId}`
- `POST /api/message-reservation-groups/{groupId}/cancel`

Sender resources screen:

- `GET /api/sender-resources`
- `POST /api/sender-resources/sms/applications`
- `POST /api/sender-resources/kakao/connect/request`
- `POST /api/sender-resources/kakao/connect/verify`

Automation rule screen:

- `GET /api/publ-events`
- `GET /api/automations/rules`
- `POST /api/automations/rules`
- `GET /api/automations/rules/{ruleId}`
- `PATCH /api/automations/rules/{ruleId}`
- `POST /api/automations/rules/{ruleId}/validate`
- `POST /api/automations/rules/{ruleId}/dry-run`
- `POST /api/automations/rules/{ruleId}/enable`
- `POST /api/automations/rules/{ruleId}/disable`
- `POST /api/automations/rules/{ruleId}/archive`

Operator screens:

- `GET /api/admin/sender-resource-applications`
- `POST /api/admin/sender-resource-applications/{id}/approve`
- `POST /api/admin/sender-resource-applications/{id}/reject`
- `GET /api/admin/settlement-runs`
- `POST /api/admin/settlement-runs`
- `GET /api/admin/settlement-runs/{id}`
- `POST /api/admin/settlement-runs/{id}/finalize`

## Automation Rules

Browser-managed automation rules are authenticated console APIs only. They are
not part of `/api/open/v1/publ/events`.

Rule responses are safe DTOs: ids, status, labels, event keys,
sender-resource labels, template code/source metadata, validation readiness,
dry-run summaries, and revision metadata. They must not include raw event
payloads, raw recipient numbers, rendered content, template parameter values,
provider request/response payloads, or encrypted payload internals.

### GET /api/publ-events

Returns PUBL event catalog summaries for the console. Automation editors may use
`variableOptions` to render alias pickers:

```json
{
  "events": [
    {
      "id": "event_definition_1",
      "eventKey": "order.created",
      "displayName": "Order created",
      "variableOptions": [
        {
          "alias": "targetPhoneNumber",
          "label": "수신자 번호",
          "type": "text",
          "required": false,
          "phoneCompatible": true
        }
      ]
    }
  ]
}
```

`variableOptions` are safe alias metadata only. They do not include raw payload
values, raw paths, parser pipelines, fallback values, or sample recipients.

### POST /api/publ-events

Creates a DB-owned PUBL event definition. This endpoint is operator-only and does
not import or sync an external JSON catalog. New events receive the default
variables `targetPhoneNumber`, `eventKey`, and `channelCode` when `props` is
omitted. When `props` is present, the supplied variable contract is saved in
the submitted order.

```json
{
  "event": {
    "eventKey": "CUSTOM_MESSAGE_READY",
    "displayName": "Custom message ready",
    "locationType": "P_APP",
    "locationId": "X00004",
    "sourceType": "message",
    "actionType": "ready"
  },
  "props": [
    {
      "rawPath": "targetPhoneNumber",
      "alias": "targetPhoneNumber",
      "label": "수신자 전화번호",
      "type": "text",
      "required": true,
      "enabled": true,
      "fallback": null,
      "sample": "010-1234-1234",
      "parserPipeline": null,
      "description": "자동화 발송 수신자 번호입니다."
    },
    {
      "rawPath": "targetName",
      "alias": "targetName",
      "label": "고객명",
      "type": "text",
      "required": false,
      "enabled": true,
      "fallback": null,
      "sample": "김민준",
      "parserPipeline": null,
      "description": "수신자 개인화 문구에 자주 사용합니다."
    }
  ]
}
```

### GET /api/automations/rules

Lists the actor-owned automation rules. Optional query fields are `status`,
`limit`, and `offset`.

### POST /api/automations/rules

Creates a disabled rule from a template-reference config:

```json
{
  "name": "Order ready",
  "eventDefinitionId": "event_definition_1",
  "sendChannel": "alimtalk",
  "senderResourceId": "kakao_resource_1",
  "templateCode": "ORDER_READY",
  "templateSource": "SENDER_PROFILE",
  "variableMapping": { "orderNo": "orderNo" },
  "recipientMapping": { "type": "event_alias", "alias": "targetPhoneNumber" },
  "condition": { "all": [{ "alias": "orderStatus", "operator": "equals", "value": "READY" }] },
  "cooldownPolicy": { "enabled": false }
}
```

### GET /api/automations/rules/{ruleId}

Returns one actor-owned rule with safe revision history.

### PATCH /api/automations/rules/{ruleId}

Updates rule config fields. Any config change clears validation readiness until
`validate` succeeds again.

### POST /api/automations/rules/{ruleId}/validate

Validates sender resource, send channel, template reference, variable mappings,
recipient mapping, conditions, and cooldown policy. Enable is rejected unless
the latest successful validation hash matches the current config hash.

### POST /api/automations/rules/{ruleId}/dry-run

Evaluates a sample envelope without sending, creating delivery rows, or writing
audit/revision data:

```json
{
  "sampleEnvelope": {
    "eventKey": "order.created",
    "externalEventId": "evt_test",
    "channelCode": "store_1",
    "payload": {}
  }
}
```

The response contains `ok`, `wouldSend`, `maskedRecipient`, safe variable
presence/type/previews, condition/cooldown/template coverage, and blocker codes.
It must not echo raw sample payload values.

### POST /api/automations/rules/{ruleId}/enable

Enables a validated rule. Only one enabled rule may exist per
`userId + eventDefinitionId`; conflicts return
`LOCAL_VALIDATION_FAILED`.

### POST /api/automations/rules/{ruleId}/disable

Disables an actor-owned rule while preserving safe revision history.

### POST /api/automations/rules/{ruleId}/archive

Archives an actor-owned rule. Archived rules are read-only and cannot be
enabled through browser APIs.

## Message Send

### POST /api/messages/sms/send

Sends SMS/LMS/MMS through NHN using an active SMS sender resource.

Headers:

```http
content-type: application/json
```

Request body:

```json
{
  "clientRequestId": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "senderResourceId": "sms_resource_1",
  "channel": "sms",
  "templateCode": "SMS_PICKUP",
  "title": "Notice",
  "body": "Pickup code ##code##",
  "recipients": [
    {
      "recipientNo": "010-1234-5678",
      "templateParameter": {
        "code": "123456"
      }
    }
  ],
  "requestDate": "2026-06-02 15:00",
  "statsId": "campaign01",
  "attachFileIdList": []
}
```

Fields:

- `clientRequestId`: required UUID. Generate on the frontend for idempotent
  lookup; do not reuse for distinct sends.
- `senderResourceId`: required active `sms_send_no` resource.
- `channel`: optional; `sms` by default. Use `lms` or `mms` for long/media
  messages.
- `title`: required for `lms` and `mms`; optional for `sms`.
- `body`: required.
- `templateCode`: optional; maps to NHN SMS template id.
- `recipients`: required array, 1 to 1000.
- `recipients[].recipientNo`: domestic phone number. Hyphens/spaces are allowed.
- `recipients[].internationalRecipientNo`: alternative international recipient.
- `recipients[].countryCode`: optional numeric country code.
- `recipients[].templateParameter`: optional object for NHN template variables.
- `statsId`: optional, max 10 characters.
- `attachFileIdList`: optional array for NHN MMS attachments.

Success:

```json
{
  "ok": true,
  "data": {
    "state": "accepted_by_provider",
    "channel": "sms",
    "clientRequestId": "de305d54-75b4-431b-adb2-eb6b9e546014",
    "senderResourceId": "sms_resource_1",
    "billingAccountId": "billing_1",
    "requestRef": "derived_request_ref",
    "recipientCount": 1,
    "lookup": {
      "channel": "sms",
      "senderResourceId": "sms_resource_1",
      "clientRequestId": "de305d54-75b4-431b-adb2-eb6b9e546014"
    },
    "provider": {
      "header": {
        "resultCode": 0,
        "resultMessage": "SUCCESS"
      },
      "requestId": "sms-request-1",
      "statusCode": "2",
      "recipients": [
        {
          "recipientSeq": 1,
          "resultCode": 0,
          "resultMessage": "SUCCESS"
        }
      ]
    }
  }
}
```

UI handling:

- On `accepted_by_provider`, show accepted/pending delivery state and use
  `lookup` for status polling if needed.
- On `unknown_after_provider_call`, do not blindly retry. Show "provider result
  unknown" and call `GET /api/messages/status` with the `lookup` values.
- Send responses intentionally do not include recipient numbers, message body,
  or template parameters.

### POST /api/messages/sms/bulk-send-runs

Creates a persistent SMS/LMS/MMS bulk send run from the existing SMS form. This
is not a campaign API and must not introduce a campaign route, campaign table,
or marketing campaign UI.

Use this endpoint only when the SMS form has more recipients than the direct
send endpoint should handle, or when the user explicitly chooses the persistent
bulk-run flow. Direct `POST /api/messages/sms/send` remains limited to 1 to
1,000 recipients. Bulk runs accept 1 to 50,000 concrete recipients and split
them into provider batches of at most 1,000 recipients.

Request body uses the SMS send fields plus a local management name:

```json
{
  "managementSendName": "June pickup reminders",
  "senderResourceId": "sms_resource_1",
  "channel": "sms",
  "templateCode": "SMS_PICKUP",
  "title": "Notice",
  "body": "Pickup code ##code##",
  "recipients": [
    {
      "recipientNo": "010-1234-5678",
      "templateParameter": {
        "code": "123456"
      }
    }
  ],
  "requestDate": "2026-06-02 15:00",
  "statsId": "pickup01",
  "attachFileIdList": []
}
```

Fields:

- `managementSendName`: required user-facing run name stored as local metadata.
- `clientRequestId`: not accepted for the whole run. The server creates the run
  ref and per-batch provider `clientRequestId` values.
- `senderResourceId`: required active `sms_send_no` resource.
- `channel`: optional; `sms` by default. Only `sms`, `lms`, and `mms` are in
  scope.
- `title`: required for `lms` and `mms`; optional for `sms`.
- `body`: required.
- `recipients`: required array, 1 to 50000. All recipients must be concrete
  phone-number recipients; unresolved segments and `all` are not expandable.
- All other fields follow `POST /api/messages/sms/send`.

Creation success status: `202`.

Success:

```json
{
  "ok": true,
  "data": {
    "id": "sms_bulk_run_1",
    "runRef": "run_abc123",
    "managementSendName": "June pickup reminders",
    "channel": "sms",
    "senderResourceId": "sms_resource_1",
    "state": "queued",
    "totalRecipientCount": 50000,
    "acceptedRecipientCount": 0,
    "batchSize": 1000,
    "totalBatchCount": 50,
    "acceptedBatchCount": 0,
    "createdAt": "2026-06-02T06:00:00.000Z",
    "startedAt": null,
    "finishedAt": null
  }
}
```

Creation rules:

- Enforce per-user SMS quota before creating the run.
- Reserve quota for `totalRecipientCount` before the worker starts.
- Generate one local run id/run ref for the whole send.
- Generate unique provider-facing batch `clientRequestId` values from the run
  ref plus batch sequence. Do not reuse one id for all batches.
- The response must not include recipient numbers, message body, title, template
  parameters, sender grouping keys, recipient grouping keys, or raw provider
  payload.

### GET /api/messages/sms/bulk-send-runs?active=true

Returns safe, browser-visible SMS bulk run summaries for the signed-in actor.
Use this endpoint from a console-level TanStack Query watcher so progress can
survive page navigation.

When `active=true`, the response includes queued/running runs and recent
terminal runs that the UI may still need for completion or attention toasts.

Success:

```json
{
  "ok": true,
  "data": {
    "runs": [
      {
        "id": "sms_bulk_run_1",
        "runRef": "run_abc123",
        "managementSendName": "June pickup reminders",
        "channel": "sms",
        "state": "running",
        "status": "running",
        "totalRecipientCount": 50000,
        "acceptedRecipientCount": 12000,
        "totalBatchCount": 50,
        "acceptedBatchCount": 12,
        "activeBatchSequence": 13,
        "createdAt": "2026-06-02T06:00:00.000Z",
        "finishedAt": null,
        "actions": {
          "logsHref": "/logs?channel=sms",
          "resultHref": "/logs?channel=sms"
        }
      }
    ]
  }
}
```

### GET /api/messages/sms/bulk-send-runs/{runId}

Returns safe provider-acceptance progress for one SMS bulk run. Browser state is
not authoritative; the frontend should poll this endpoint with TanStack Query
and must allow progress to survive page navigation.

Success:

```json
{
  "ok": true,
  "data": {
    "id": "sms_bulk_run_1",
    "runRef": "run_abc123",
    "managementSendName": "June pickup reminders",
    "channel": "sms",
    "senderResourceId": "sms_resource_1",
    "state": "running",
    "totalRecipientCount": 50000,
    "acceptedRecipientCount": 12000,
    "batchSize": 1000,
    "totalBatchCount": 50,
    "acceptedBatchCount": 12,
    "activeBatchSequence": 13,
    "attentionReason": null,
    "errorMessage": null,
    "createdAt": "2026-06-02T06:00:00.000Z",
    "startedAt": "2026-06-02T06:00:03.000Z",
    "finishedAt": null,
    "actions": {
      "logsHref": "/logs?channel=sms",
      "resultHref": "/message-send/runs/sms_bulk_run_1"
    }
  }
}
```

Run states:

```text
queued
running
completed
blocked
failed
canceled
```

UI handling:

- Active progress copy: `{accepted} / {total} recipients accepted by provider`.
- Completed copy: `{total} recipients accepted by provider`.
- Failed or blocked copy: show a short failure or attention message and a logs
  or run-result action when available.
- Completion toast should include an action to open logs or the run result view.
- `blocked` means later batches stopped because the provider result became
  uncertain, timed out, or rate limited. Do not auto-retry.
- `acceptedRecipientCount` is provider acceptance progress only. NHN final
  delivery logs remain the source of truth for delivery status.
- Status responses must never expose recipient numbers, message body, rendered
  content, template parameters, grouping keys, or raw provider payloads.

### POST /api/messages/alimtalk/send

Sends Kakao AlimTalk through NHN using an active Kakao sender key. Optional SMS
fallback requires an active SMS sender resource.

Request body:

```json
{
  "clientRequestId": "de305d54-75b4-431b-adb2-eb6b9e546014",
  "senderResourceId": "kakao_resource_1",
  "templateCode": "ORDER_READY",
  "recipients": [
    {
      "recipientNo": "010-1234-5678",
      "templateParameter": {
        "orderNo": "ORDER-123"
      },
      "buttons": []
    }
  ],
  "fallback": {
    "enabled": true,
    "smsSenderResourceId": "sms_resource_1",
    "resendType": "SMS",
    "resendTitle": "Fallback title",
    "resendContent": "Fallback body"
  },
  "requestDate": "2026-06-02 15:00",
  "statsId": "campaign01",
  "messageOption": {
    "price": 0,
    "currencyType": "KRW"
  }
}
```

Fields:

- `clientRequestId`: required UUID.
- `senderResourceId`: required active `kakao_sender_key` resource.
- `templateCode`: required.
- `recipients`: required array, 1 to 1000.
- `recipients[].recipientNo`: required.
- `recipients[].templateParameter`: optional object.
- `recipients[].content`: optional raw AlimTalk content if required by provider
  flow.
- `recipients[].templateTitle`, `templateSubtitle`, `templateHeader`: optional.
- `recipients[].templateItem`, `templateItemHighlight`,
  `templateRepresentLink`: optional objects.
- `recipients[].buttons`, `quickReplies`: optional object arrays.
- `fallback.enabled`: false by default.
- `fallback.smsSenderResourceId`: required when fallback is enabled.
- `fallback.resendType`: optional `SMS` or `LMS`.
- `messageOption.price`: optional non-negative integer.

Success shape is the same as SMS, with `channel: "alimtalk"` and provider
recipient results from NHN.

## Message Status and Logs

### GET /api/messages/status

Looks up NHN logs by the server-owned grouping key derived from
`clientRequestId`. Use this after send acceptance or timeout/unknown states.

Query:

```text
channel=sms|lms|mms|alimtalk|brand-message
senderResourceId=sms_resource_1
clientRequestId=de305d54-75b4-431b-adb2-eb6b9e546014
```

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "sms",
    "senderResourceId": "sms_resource_1",
    "clientRequestId": "de305d54-75b4-431b-adb2-eb6b9e546014",
    "state": "found",
    "logs": [
      {
        "id": "sms:sms-request-1:1",
        "channel": "sms",
        "requestId": "sms-request-1",
        "recipientSeq": 1,
        "senderLabel": "Main SMS",
        "recipientNo": "01012345678",
        "contentPreview": "Preview text",
        "templateCode": "SMS_PICKUP",
        "requestDate": "2026-06-02 15:00:00",
        "receiveDate": "2026-06-02 15:00:03",
        "status": "3",
        "resultCode": 1000,
        "resultMessage": "SUCCESS"
      }
    ]
  }
}
```

`state: "unknown"` means NHN did not return matching rows in the default
lookback window. It is not proof that no message was sent.

When `state: "found"`, the server may also best-effort merge those matching
rows into the local result snapshot so open message-log screens can refresh
quickly. This endpoint is still only a foreground UX fast path; durable result
updates come from webhooks and the correction worker.

### GET /api/message-reservations

Lists authorized NHN reservation rows grouped for the `/reservations` screen.
SMS/LMS/MMS reservation rows are shown under the `sms` channel tab because
LMS/MMS are send types, not separate reservation channels.

Query:

```text
channel=all|sms|alimtalk|brand-message
from=2026-06-06T00:00:00.000Z
to=2026-06-12T23:59:59.999Z
page=1
pageSize=20
```

Rules:

- `from` and `to` are required.
- The relay fetches provider reservation pages for authorized sender resources,
  authorizes rows, maps SMS provider request ids to actor-owned SMS bulk runs,
  builds groups, sorts groups, and only then slices the requested page.
- `total` is the authorized group count.
- A scheduled SMS bulk run with three provider request ids appears as one group
  when those ids map to the same `sms_bulk_send_runs.id`.
- List rows must not include `providerRequestIds` arrays, recipient numbers,
  full message bodies, raw grouping keys, raw provider rows, or worker payloads.

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "sms",
    "from": "2026-06-06T00:00:00.000Z",
    "to": "2026-06-12T23:59:59.999Z",
    "page": 1,
    "pageSize": 20,
    "hasNextPage": false,
    "total": 1,
    "groups": [
      {
        "id": "opaque-reservation-group-id",
        "groupType": "bulk_run",
        "bulkRunId": "sms_bulk_run_1",
        "managementTitle": "June reservation batch",
        "channel": "sms",
        "senderLabel": "Main SMS",
        "recipientCount": 3000,
        "reservedCount": 3000,
        "completedCount": 0,
        "failedCount": 0,
        "canceledCount": 0,
        "aggregateState": "reserved",
        "requestDate": "2026-06-07 10:00:00",
        "representativeRequestId": "sms-provider-request-1",
        "providerRequestCount": 3
      }
    ]
  }
}
```

Provider-request rows use `groupType: "provider_request"` and keep a single
`requestId` field for compatibility. Bulk rows use the opaque `id` as their
primary UI identity; the browser must not submit provider request id arrays for
detail or cancel.

### GET /api/message-reservation-groups/{groupId}

Returns one authorized reservation group and its public recipient reservation
rows. Use the `id` from `GET /api/message-reservations`.

Query:

```text
channel=all|sms|alimtalk|brand-message
from=2026-06-06T00:00:00.000Z
to=2026-06-12T23:59:59.999Z
```

The relay rescans the same provider range, authorizes rows again, maps SMS bulk
provider request ids again, and returns the matching opaque group id.

### POST /api/message-reservation-groups/{groupId}/cancel

Cancels cancelable SMS reservation recipients in one authorized group.

Rules:

- Use the opaque `groupId` plus the current `channel`, `from`, and `to`
  filters.
- The browser must not send provider request id arrays.
- For SMS bulk groups, the server internally expands the group into provider
  `{ requestId, recipientSeq }` cancel targets.
- AlimTalk and Brand Message reservation cancel are hidden in the UI and
  rejected by the backend in this phase.

### GET /api/message-log-groups

Lists local message-log ledger rows for the signed-in actor and channel. This
is the top-level `/logs` list API. It returns one row per user send action and
does not scan provider recipient rows on list load.

Query:

```text
channel=sms|alimtalk|brand-message
messageType=sms|lms|mms
from=2026-06-01T00:00:00.000Z
to=2026-06-02T00:00:00.000Z
page=1
pageSize=20
```

Rules:

- `channel` is required and must be concrete. Do not add an `all` channel in
  this phase.
- `sms` is the top-level text-message family channel. It includes local ledger
  rows whose stored message type is `sms`, `lms`, or `mms`.
- `messageType` is optional and only valid with `channel=sms`. Use it as a
  secondary filter when the UI needs to narrow the SMS-family tab.
- `from` and `to` are required.
- Normal list queries return non-archived rows. User-visible logs are retained
  for 90 days before archive.
- `page` defaults to 1.
- `pageSize` defaults to 20 and must be 1 to 100.
- The relay reads local ledger rows and child request summaries only. It must
  not fetch provider logs, provider recipient rows, or provider request pages.
- The relay authorizes with the current actor and local sender-resource
  ownership. Caller-supplied user, account, billing, grouping-key, or
  sender-resource override filters are ignored or rejected.
- `total` is the authorized send-action row count, not a recipient row count.
- Rows sort by latest operational send date descending, then stable ledger id
  ascending.
- Group summaries never include recipient numbers, full message content, raw
  grouping keys, provider request id arrays, message titles, rendered content,
  template values, buttons, raw provider rows, `context`, or `raw`.

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "sms",
    "from": "2026-06-01T00:00:00.000Z",
    "to": "2026-06-02T00:00:00.000Z",
    "page": 1,
    "pageSize": 20,
    "hasNextPage": false,
    "total": 1,
    "groups": [
      {
        "id": "n3wI9Q7o6lP1k2dEwS4F3a8B0cY5zR6tV7uX9mA1bC",
        "channel": "sms",
        "messageType": "sms",
        "senderLabel": "Main SMS",
        "sendKind": "bulk",
        "sendTiming": "immediate",
        "managementTitle": "June bulk send",
        "sentAt": "2026-06-02T06:00:00.000Z",
        "scheduledAt": null,
        "totalRecipientCount": 3000,
        "providerState": "accepted",
        "resultState": "synced",
        "providerRequestCount": 3,
        "acceptedRequestCount": 3,
        "successCount": 2980,
        "failedCount": 20,
        "pendingCount": 0,
        "lastResultSyncedAt": "2026-06-02T06:16:00.000Z",
        "resultFinalizedAt": null,
        "actions": {
          "detailHref": "/logs/n3wI9Q7o6lP1k2dEwS4F3a8B0cY5zR6tV7uX9mA1bC"
        }
      }
    ]
  }
}
```

Group summary fields:

- `id`: opaque URL-safe local ledger group id.
- `channel`: `sms`, `alimtalk`, or `brand-message`.
- `messageType`: `sms`, `lms`, or `mms` for SMS-family rows, otherwise `null`.
- `senderLabel`: display label for the authorized sender resource.
- `sendKind`: `basic` or `bulk`. Bulk means the persistent grouped send flow was
  used, even when there is only one provider request row.
- `sendTiming`: `immediate` or `scheduled`.
- `managementTitle`: bounded operational label. It must not be copied from
  message title, body, rendered content, template values, buttons, recipient
  data, or fallback content.
- `sentAt`: accepted immediate send time when known.
- `scheduledAt`: scheduled send time for reservation-backed rows, otherwise
  `null`.
- `totalRecipientCount`: requested send-action recipient count.
- `providerState`: provider request state such as `accepted`, `rejected`,
  `unknown`, or `canceled`.
- `resultState`: local snapshot aggregation state such as `not_synced`,
  `partially_synced`, `synced`, `stale`, or `error`.
- `providerRequestCount`: count of local child provider request summaries.
- `acceptedRequestCount`: count of child request summaries accepted by the
  provider.
- `successCount`, `failedCount`, `pendingCount`: cached result counts. They are
  meaningful only when `resultState` is not `not_synced`.
- `lastResultSyncedAt`: last local aggregate result check time, or `null`.
- `resultFinalizedAt`: time automatic result tracking ended, or `null`.
- AlimTalk and Brand Message remain non-bulk in this phase. Their ledger rows
  use `sendKind: "basic"` and continue to follow existing per-send/request
  limits and daily channel caps.

UI handling:

- Use grouped list rows as the top-level 발송기록 table.
- Use the group `id` plus the current `channel` to load group detail.
- Do not show a fake zero-success result before webhook or correction results
  arrive. For accepted pending sends, use `접수 완료 · 결과 집계 중`.
- User-facing product copy must not mention third-party provider brand names.
  Use neutral language such as `provider`, `message provider`, `external
  provider`, or channel labels.
- Use the webhook-first display statuses: `접수 중`,
  `접수 완료 · 결과 집계 중`, `접수 일부 실패 · 결과 집계 중`,
  `완료 · 성공`, `완료 · 일부 실패`, and
  `집계 마감 · 일부 미확인`.
- `새로고침` may refetch local DB list/detail/failure queries only. It must not
  trigger a provider scan or manual result-sync API.
- Avoid raw internal state names and stiff provider-admin labels in the primary
  list experience.
- Do not use the `frontend-design` skill in this phase or future harness phases.
- Do not split basic and bulk sends into separate tabs. Use badges or filters
  inside the channel list.
- Batch/provider request details are technical details for the detail screen,
  not the primary list experience.

### GET /api/message-log-groups/{groupId}

Returns one authorized local ledger group plus child request summaries. It does
not fetch recipient rows by default.

Path params:

- `groupId`: opaque URL-safe group id from the grouped list response.

Query:

```text
channel=sms|alimtalk|brand-message
from=2026-06-01T00:00:00.000Z
to=2026-06-02T00:00:00.000Z
```

Rules:

- `channel` is required.
- `from` and `to` may be used to keep the detail route aligned with the current
  list filters, but authorization comes from the current actor and local group
  ownership.
- The relay reads local group and child request summaries only.
- The response contains `group` and `requests`.
- Child request summaries use local opaque request ids. Browser DTOs, list
  rows, query keys, analytics, local storage, toasts, refresh actions, and
  detail links must not expose provider request ids or provider request id
  arrays.

Success:

```json
{
  "ok": true,
  "data": {
    "group": {
      "id": "n3wI9Q7o6lP1k2dEwS4F3a8B0cY5zR6tV7uX9mA1bC",
      "channel": "sms",
      "messageType": "sms",
      "senderLabel": "Main SMS",
      "sendKind": "bulk",
      "sendTiming": "immediate",
      "managementTitle": "June bulk send",
      "sentAt": "2026-06-02T06:00:00.000Z",
      "scheduledAt": null,
      "totalRecipientCount": 3000,
      "providerState": "accepted",
      "resultState": "synced",
      "providerRequestCount": 3,
      "acceptedRequestCount": 3,
      "successCount": 2980,
      "failedCount": 20,
      "pendingCount": 0,
      "lastResultSyncedAt": "2026-06-02T06:16:00.000Z",
      "resultFinalizedAt": null
    },
    "requests": [
      {
        "id": "ledger_request_1",
        "sequence": 1,
        "providerState": "accepted",
        "resultState": "synced",
        "recipientCount": 1000,
        "successCount": 995,
        "failedCount": 5,
        "pendingCount": 0,
        "lastResultSyncedAt": "2026-06-02T06:16:00.000Z",
        "resultFinalizedAt": null,
        "canFetchRecipients": true
      }
    ]
  }
}
```

UI handling:

- Render request summaries in group detail. Fetch recipient rows only after the
  user opens one request or asks to inspect recipients.
- Use the request-recipient endpoint below for paged recipient rows.
- Use the existing row detail endpoint for full content after a recipient row is
  selected.
- Use the existing row resend endpoint for individual failed recipients.
- CSV export remains recipient-row CSV through `GET /api/message-logs/export`;
  grouped CSV export is out of scope for this phase.
- `새로고침` refetches local group, request, and failure summaries only. It must
  not run a provider scan or call a manual result-sync endpoint.

### GET /api/message-log-groups/{groupId}/requests/{requestLocalId}/failures

Lists failed recipients for one authorized local provider-request summary. It
reads `resultSnapshotJson.failedRecipientNos` only; it does not call NHN, page
provider recipient rows, or expose provider request ids.

Query:

```text
page=1
pageSize=50
```

Rules:

- `recipientNo` is the raw failed recipient number from
  `resultSnapshotJson.failedRecipientNos[String(recipientSeq)]`, normalized only
  for bounded local storage.
- Success, pending, and canceled recipient numbers must not appear in
  `failedRecipientNos` or this response.
- Missing failed-recipient numbers are returned as `recipientNo: null`.
- If a later authoritative correction changes a failed row to success or cancel,
  the failed number for that sequence is removed from the snapshot.

Success:

```json
{
  "ok": true,
  "data": {
    "page": 1,
    "pageSize": 50,
    "total": 1,
    "hasNextPage": false,
    "group": {
      "id": "n3wI9Q7o6lP1k2dEwS4F3a8B0cY5zR6tV7uX9mA1bC"
    },
    "request": {
      "id": "ledger_request_1",
      "sequence": 1,
      "label": "요청 1"
    },
    "failures": [
      {
        "groupId": "n3wI9Q7o6lP1k2dEwS4F3a8B0cY5zR6tV7uX9mA1bC",
        "requestLocalId": "ledger_request_1",
        "requestSequence": 1,
        "requestLabel": "요청 1",
        "channel": "sms",
        "recipientSeq": 2,
        "recipientNo": "01099998888",
        "resultCode": "3003",
        "resultCodeLabel": "실패 · 수신 번호 오류 또는 결번"
      }
    ]
  }
}
```

### GET /api/message-log-groups/{groupId}/requests/{requestLocalId}/recipients

Fetches one provider request page for one authorized local request summary. The
relay does not persist recipient rows.

Query:

```text
page=1
pageSize=50
```

Rules:

- `groupId` and `requestLocalId` are local opaque identifiers.
- The relay authorizes the current actor against the local group and request
  summary before fetching the provider request page.
- The response uses public recipient-row DTOs and never includes raw grouping
  keys, `userRef`, `billingRef`, `resourceRef`, `requestRef`, raw provider rows,
  `context`, or `raw`.
- This route is for detail inspection and recipient pages, not top-level list
  loading.

Success:

```json
{
  "ok": true,
  "data": {
    "group": {
      "id": "n3wI9Q7o6lP1k2dEwS4F3a8B0cY5zR6tV7uX9mA1bC",
      "channel": "sms",
      "managementTitle": "June bulk send"
    },
    "request": {
      "id": "ledger_request_1",
      "sequence": 1,
      "recipientCount": 1000
    },
    "page": 1,
    "pageSize": 50,
    "hasNextPage": true,
    "total": 1000,
    "recipients": [
      {
        "id": "sms:sms-request-1:1",
        "channel": "sms",
        "requestId": "sms-request-1",
        "recipientSeq": 1,
        "senderLabel": "Main SMS",
        "recipientNo": "01012345678",
        "contentPreview": "Preview text",
        "templateCode": "SMS_PICKUP",
        "requestDate": "2026-06-02 15:00:00",
        "receiveDate": "2026-06-02 15:00:03",
        "status": "3",
        "resultCode": 1000,
        "resultMessage": "SUCCESS"
      }
    ]
  }
}
```

### GET /api/message-logs

Lists authorized NHN message logs for the user and channel as recipient rows.
This endpoint remains the compatibility API for row-level list behavior.

Query:

```text
channel=sms|lms|mms|alimtalk|brand-message
from=2026-06-01T00:00:00.000Z
to=2026-06-02T00:00:00.000Z
page=1
pageSize=20
```

Rules:

- `from` and `to` are required.
- Range must be 30 days or less.
- `page` defaults to 1.
- `pageSize` defaults to 20 and must be 1 to 100.
- The relay fetches all provider pages needed for the requested range before it
  slices authorized rows for the UI page. If a provider scan exceeds the server
  safety budget, the endpoint fails with `LOCAL_VALIDATION_FAILED` and the UI
  should ask the user to narrow the date range.

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "sms",
    "from": "2026-06-01T00:00:00.000Z",
    "to": "2026-06-02T00:00:00.000Z",
    "page": 1,
    "pageSize": 20,
    "hasNextPage": false,
    "total": 1,
    "logs": [
      {
        "id": "sms:sms-request-1:1",
        "channel": "sms",
        "requestId": "sms-request-1",
        "recipientSeq": 1,
        "senderLabel": "Main SMS",
        "recipientNo": "01012345678",
        "contentPreview": "Preview text",
        "templateCode": "SMS_PICKUP",
        "requestDate": "2026-06-02 15:00:00",
        "receiveDate": "2026-06-02 15:00:03",
        "status": "3",
        "resultCode": 1000,
        "resultMessage": "SUCCESS"
      }
    ]
  }
}
```

UI handling:

- Treat `recipientNo` and `contentPreview` as NHN-sourced display data.
- Do not expect raw grouping keys or raw provider rows; they are removed.

### GET /api/message-logs/{channel}/{requestId}/{recipientSeq}

Returns one authorized NHN log row with detail fields for display. This remains
the only API that returns full row content after a recipient row is selected.

Path params:

- `channel`: `sms`, `lms`, `mms`, `alimtalk`, or `brand-message`.
- `requestId`: NHN request id.
- `recipientSeq`: provider recipient sequence, non-negative integer.

Success adds `detail`:

```json
{
  "ok": true,
  "data": {
    "id": "sms:sms-request-1:1",
    "channel": "sms",
    "requestId": "sms-request-1",
    "recipientSeq": 1,
    "senderLabel": "Main SMS",
    "recipientNo": "01012345678",
    "contentPreview": "Preview text",
    "templateCode": "SMS_PICKUP",
    "requestDate": "2026-06-02 15:00:00",
    "receiveDate": "2026-06-02 15:00:03",
    "status": "3",
    "resultCode": 1000,
    "resultMessage": "SUCCESS",
    "detail": {
      "recipientNo": "01012345678",
      "content": "Full provider content",
      "title": "SMS title",
      "buttons": [],
      "quickReplies": [],
      "templateItem": null,
      "templateItemHighlight": null,
      "templateRepresentLink": null,
      "messageOption": null
    }
  }
}
```

For AlimTalk and Brand Message, `detail` may contain `buttons`,
`quickReplies`, template item objects, represent links, and message options.

### POST /api/message-logs/{channel}/{requestId}/{recipientSeq}/resend

Resends a failed authorized NHN log row. No request body is required.

Rules:

- Only failed/canceled/error provider rows are accepted.
- User must have sender access to the original sender resource.
- The relay creates a new `clientRequestId` for the resend.
- Brand Message rows can be listed, viewed, and exported, but resend is not
  supported by this endpoint.

Success:

```json
{
  "ok": true,
  "data": {
    "state": "accepted_by_provider",
    "channel": "sms",
    "original": {
      "requestId": "sms-request-1",
      "recipientSeq": 1
    },
    "clientRequestId": "new-resend-uuid",
    "requestRef": "derived_request_ref",
    "senderResourceId": "sms_resource_1",
    "provider": {
      "header": {
        "resultCode": 0,
        "resultMessage": "SUCCESS"
      },
      "requestId": "sms-resend-request-1"
    }
  }
}
```

### GET /api/message-logs/export

Exports authorized NHN log rows as recipient-row CSV. Grouped CSV export is not
part of this phase.

Query:

```text
channel=sms|lms|mms|alimtalk|brand-message
from=2026-06-01T00:00:00.000Z
to=2026-06-02T00:00:00.000Z
```

This endpoint does not use the JSON success envelope. It returns:

```http
200 OK
content-type: text/csv; charset=utf-8
content-disposition: attachment; filename="message-logs-sms-2026-06-01-2026-06-02.csv"
x-relay-export-row-count: 12
```

CSV columns:

```text
id,channel,requestId,recipientSeq,senderLabel,recipientNo,contentPreview,templateCode,requestDate,receiveDate,status,resultCode,resultMessage
```

The server hardens formula-like CSV cells. The frontend should handle this as a
file download action.

## Sender Resources

### GET /api/sender-resources

Lists active sender resources and the user's sender resource applications.

Success:

```json
{
  "ok": true,
  "data": {
    "resources": [
      {
        "id": "link_1",
        "userId": "user_1",
        "senderResourceId": "sms_resource_1",
        "billingAccountId": "billing_1",
        "role": "owner",
        "status": "active",
        "isDefault": false,
        "resource": {
          "id": "sms_resource_1",
          "resourceRef": "smsref1",
          "provider": "nhn",
          "type": "sms_send_no",
          "value": "15446859",
          "displayName": "Main SMS",
          "status": "active",
          "providerStatus": "approved",
          "metadataJson": {}
        }
      }
    ],
    "applications": [
      {
        "id": "application_1",
        "userId": "user_1",
        "resourceType": "sms_send_no",
        "requestedValue": "15446859",
        "status": "submitted",
        "reviewedBy": null,
        "reviewedAt": null,
        "reviewMemo": null,
        "rejectReason": null,
        "createdAt": "2026-06-02T00:00:00.000Z",
        "updatedAt": "2026-06-02T00:00:00.000Z",
        "evidenceFiles": []
      }
    ]
  }
}
```

Use `resources[].resource.type` to filter compatible senders:

- SMS/LMS/MMS send: `sms_send_no`.
- AlimTalk/Brand Message send: `kakao_sender_key`.

### POST /api/sender-resources/sms/applications

Submits an SMS sender number application.

Accepted content types:

- `application/json`
- `multipart/form-data`

JSON body:

```json
{
  "sendNo": "1544-6859",
  "evidenceFiles": []
}
```

Multipart body:

- `payload`: JSON string, for example `{"sendNo":"1544-6859"}`.
- Additional file parts: private evidence files.
- Or `evidenceFiles`: JSON string containing private object descriptors.

In production, prefer multipart file parts so the relay stores evidence in the
private R2 bucket with server-generated application-scoped object keys. JSON
descriptors must reference private, server-issued object keys only. Do not
include public URLs, signed URLs, download URLs, or arbitrary external object
locations in evidence metadata.

Success status: `201`.

Success data is an application DTO:

```json
{
  "ok": true,
  "data": {
    "id": "application_1",
    "userId": "user_1",
    "resourceType": "sms_send_no",
    "requestedValue": "15446859",
    "status": "submitted",
    "evidenceFiles": [
      {
        "id": "evidence_1",
        "applicationId": "application_1",
        "originalFileName": "registration.pdf",
        "contentType": "application/pdf",
        "byteSize": 2048,
        "checksumSha256": "optional-sha256",
        "status": "active",
        "deleteAfter": null,
        "deletedAt": null,
        "createdAt": "2026-06-02T00:00:00.000Z",
        "updatedAt": "2026-06-02T00:00:00.000Z"
      }
    ]
  }
}
```

### POST /api/sender-resources/kakao/connect/request

Starts NHN Kakao sender connection.

Request body:

```json
{
  "plusFriendId": "@brand",
  "phoneNo": "01012345678",
  "categoryCode": "001"
}
```

Success status: `201`.

```json
{
  "ok": true,
  "data": {
    "application": {
      "id": "application_1",
      "resourceType": "kakao_sender_key",
      "requestedValue": "@brand",
      "status": "submitted",
      "evidenceFiles": []
    },
    "provider": {
      "resultCode": 0,
      "resultMessage": "SUCCESS",
      "isSuccessful": true
    }
  }
}
```

### POST /api/sender-resources/kakao/connect/verify

Verifies the NHN Kakao sender token and activates a sender resource.

Request body:

```json
{
  "applicationId": "application_1",
  "plusFriendId": "@brand",
  "token": 123456,
  "senderKey": "optional-provider-sender-key"
}
```

Success:

```json
{
  "ok": true,
  "data": {
    "application": {
      "id": "application_1",
      "resourceType": "kakao_sender_key",
      "requestedValue": "sender-key-1",
      "status": "approved"
    },
    "resource": {
      "id": "link_1",
      "senderResourceId": "kakao_resource_1",
      "role": "owner",
      "status": "active",
      "resource": {
        "id": "kakao_resource_1",
        "provider": "nhn",
        "type": "kakao_sender_key",
        "value": "sender-key-1",
        "displayName": "@brand",
        "status": "active",
        "providerStatus": "active"
      }
    },
    "senderGroup": {
      "configured": true,
      "added": true,
      "groupSenderKey": "group-sender-key"
    },
    "provider": {
      "resultCode": 0,
      "resultMessage": "SUCCESS",
      "isSuccessful": true
    }
  }
}
```

If default sender group sync fails, verification can still succeed with
`senderGroup.added: false` and a safe provider error object.

## Templates

### GET /api/templates/sms

Lists usable NHN SMS templates for an active SMS sender resource.

Query:

```text
senderResourceId=sms_resource_1
categoryId=optional
templateName=optional
```

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "sms",
    "senderResource": {
      "id": "sms_resource_1",
      "resourceRef": "smsref1",
      "provider": "nhn",
      "type": "sms_send_no",
      "value": "15446859",
      "displayName": "Main SMS",
      "status": "active",
      "providerStatus": "approved"
    },
    "templates": [
      {
        "id": "SMS_PICKUP",
        "value": "SMS_PICKUP",
        "channel": "sms",
        "templateId": "SMS_PICKUP",
        "templateCode": "SMS_PICKUP",
        "templateName": "Pickup",
        "label": "Pickup",
        "description": "Pickup code",
        "providerStatus": "APR",
        "providerStatusCode": "Y",
        "categoryId": 1,
        "categoryName": "Default",
        "sendNo": "15446859",
        "sendType": "0",
        "sendTypeName": "SMS",
        "title": null,
        "body": "Pickup code ##code##",
        "content": "Pickup code ##code##",
        "attachments": [],
        "requiredVariables": ["code"],
        "variables": [
          {
            "key": "code",
            "type": "string",
            "fallbackValue": ""
          }
        ]
      }
    ]
  }
}
```

SMS variable syntax is `##variable##`.

### POST /api/templates/sms/attachments

Uploads one MMS template attachment for an active SMS sender resource and
returns the provider file id to use in `attachFileIdList`. This endpoint uploads
a file only; it must not create a template, send a message, reserve a message,
write a send log, or store image bytes locally.

Headers:

```http
content-type: application/json
```

Request body:

```json
{
  "senderResourceId": "sms_resource_1",
  "fileName": "notice.jpg",
  "fileBody": "base64-encoded-jpeg"
}
```

Fields:

- `senderResourceId`: required active `sms_send_no` resource.
- `fileName`: required `.jpg` or `.jpeg` filename, max 45 characters.
- `fileBody`: required base64-encoded JPEG bytes, max 300 KB after decoding.

Success status: `201`.

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "sms",
    "senderResource": {
      "id": "sms_resource_1",
      "resourceRef": "smsref1",
      "provider": "nhn",
      "type": "sms_send_no",
      "value": "15446859",
      "displayName": "Main SMS",
      "status": "active",
      "providerStatus": "approved"
    },
    "fileId": 123,
    "fileName": "notice.jpg",
    "byteSize": 2048
  }
}
```

Rules:

- The browser calls this relay route, never the provider API directly.
- The relay verifies actor ownership of the active SMS sender resource before
  upload.
- The relay sets provider `createUser` from a safe local server value.
- The provider payload contains only `fileName`, `fileBody`, and `createUser`.
- Responses must not include `fileBody`, raw provider response envelopes,
  provider file paths, saved file names, provider URL internals, credentials, or
  sender grouping keys.
- The browser must still enforce the UI-only MMS constraints before upload:
  max 3 uploaded files per template draft and max 1000 x 1000 image dimensions.
- After upload, `POST /api/templates/sms` may receive the returned `fileId`
  inside `attachFileIdList`.

### POST /api/templates/sms

Registers an SMS/LMS/MMS template through the active SMS sender resource. This
endpoint creates a provider template only; it must not send a message, reserve a
message, write a send log, or store template content locally.

Headers:

```http
content-type: application/json
```

Request body:

```json
{
  "senderResourceId": "sms_resource_1",
  "templateId": "SMS_PICKUP",
  "templateName": "Pickup",
  "templateDesc": "Pickup code",
  "sendType": "0",
  "title": null,
  "body": "Pickup code ##code##",
  "useYn": "Y",
  "attachFileIdList": []
}
```

Fields:

- `senderResourceId`: required active `sms_send_no` resource.
- `templateId`: required provider template id, max 50 characters.
- `templateName`: required provider template name, max 50 characters.
- `templateDesc`: optional provider description, max 100 characters.
- `sendType`: required provider value. The frontend must derive it from the
  draft, not ask the user to choose SMS/LMS/MMS: use `"1"` when the template
  has uploaded/pending image attachments or the literal template body exceeds
  90 bytes, otherwise use `"0"`.
- `title`: max 120 characters and required when the derived `sendType` is
  `"1"`.
- `body`: required template body, max 4,000 characters.
- `useYn`: required `"Y"` or `"N"`.
- `attachFileIdList`: optional integer array for MMS attachments that were
  already uploaded through a provider-safe file flow.

The frontend must not send `categoryId`. The relay resolves the provider SMS
template category on the server by ensuring a root `NOTI` category and a stable
user child category named from the actor's `userRef`, then injecting the
provider-issued integer `categoryId` into the NHN template registration payload.

SMS templates with variables can still be charged as LMS at send time if the
rendered recipient-specific body exceeds the SMS byte threshold after variable
substitution. The template registration UI should surface this as a billing
warning while keeping the provider template registration payload free of sample
variable values.

Rejected fields include browser-supplied `sendNo`, browser-supplied
`categoryId`, Notification Hub-only fields such as `messagePurpose`,
`templateLanguage`, `sender`, and `content`, and send-only fields such as
recipients, template parameters, schedule fields, grouping keys, unsubscribe
fields, and stats fields. The relay resolves `sendNo` from `senderResourceId`
on the server.

Success status: `201`.

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "sms",
    "senderResource": {
      "id": "sms_resource_1",
      "resourceRef": "smsref1",
      "provider": "nhn",
      "type": "sms_send_no",
      "value": "15446859",
      "displayName": "Main SMS",
      "status": "active",
      "providerStatus": "approved"
    },
    "templateCode": "SMS_PICKUP",
    "template": {
      "id": "SMS_PICKUP",
      "value": "SMS_PICKUP",
      "channel": "sms",
      "templateId": "SMS_PICKUP",
      "templateCode": "SMS_PICKUP",
      "templateName": "Pickup",
      "label": "Pickup",
      "description": "Pickup code",
      "providerStatus": "APR",
      "providerStatusCode": "Y",
      "categoryId": 1,
      "sendNo": "15446859",
      "sendType": "0",
      "title": null,
      "body": "Pickup code ##code##",
      "content": "Pickup code ##code##",
      "attachments": [],
      "requiredVariables": ["code"],
      "variables": [
        {
          "key": "code",
          "type": "string",
          "fallbackValue": ""
        }
      ]
    }
  }
}
```

Rules:

- The browser calls this relay route, never the provider API directly.
- Before template creation, the relay calls `GET/POST
  /sms/v3.0/appKeys/{appKey}/categories` as needed to ensure `NOTI / u_{userRef}`.
- The relay calls `POST /sms/v3.0/appKeys/{appKey}/templates`.
- The success data returns a normalized template DTO. It does not expose the raw
  provider response envelope.
- If provider detail refetch is briefly unavailable after creation, the relay
  returns a synthesized normalized DTO from the validated provider payload.
- The relay must not persist SMS template body, title, attachment metadata, raw
  provider payload, recipient values, grouping keys, schedule fields, or send
  request data locally.

### GET /api/templates/alimtalk

Lists AlimTalk templates for an active Kakao sender resource. By default it
requests approved templates (`TSC03`). It can include common group templates
and sender-profile templates.

Query:

```text
senderResourceId=kakao_resource_1
templateCode=optional
templateName=optional
templateStatus=optional // TSC01 요청, TSC02 검수중, TSC03 승인, TSC04 반려
```

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "alimtalk",
    "senderResource": {
      "id": "kakao_resource_1",
      "provider": "nhn",
      "type": "kakao_sender_key",
      "value": "sender-key-1",
      "displayName": "@brand",
      "status": "active",
      "providerStatus": "active"
    },
    "templates": [
      {
        "id": "SENDER_PROFILE:ORDER_READY",
        "value": "ORDER_READY",
        "channel": "alimtalk",
        "source": "SENDER_PROFILE",
        "templateCode": "ORDER_READY",
        "templateName": "Order Ready",
        "label": "Order Ready - @brand",
        "ownerKey": "sender-key-1",
        "ownerLabel": "@brand",
        "plusFriendId": "@brand",
        "senderKey": "sender-key-1",
        "providerStatus": "APR",
        "providerStatusCode": "TSC03",
        "body": "Order #{orderNo} is ready.",
        "content": "Order #{orderNo} is ready.",
        "buttons": [],
        "quickReplies": [],
        "requiredVariables": ["orderNo"],
        "variables": [
          {
            "key": "orderNo",
            "type": "string",
            "fallbackValue": ""
          }
        ]
      }
    ]
  }
}
```

AlimTalk variable syntax is `#{variable}`.

Template `source` values:

```text
GROUP
SENDER_PROFILE
```

### POST /api/templates/alimtalk

Registers an AlimTalk template review request for an active Kakao sender
resource. The browser submits `senderResourceId`; the server resolves the NHN
`senderKey` from the authorized sender resource.

Request body:

```json
{
  "senderResourceId": "kakao_resource_1",
  "templateCode": "ORDER_READY",
  "templateName": "Order Ready",
  "templateContent": "Order #{orderNo} is ready.",
  "templateMessageType": "BA",
  "templateEmphasizeType": "NONE",
  "buttons": []
}
```

Provider endpoint:

```text
POST /alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates
```

Success status: `201`.

Image-type templates are blocked until provider template-image upload is wired.

### POST /api/templates/brand

Registers the current Brand Message freestyle draft as a provider template for
an active Kakao sender resource. This endpoint creates a template only; it must
not send a message, reserve a message, write a send log, or store template
content locally.

Headers:

```http
content-type: application/json
```

Request body:

```json
{
  "senderResourceId": "kakao_resource_1",
  "templateName": "June promotion wide image",
  "chatBubbleType": "WIDE",
  "content": "New arrivals are ready.",
  "image": {
    "imageUrl": "https://provider-image.example/image.png",
    "imageSeq": "image-seq-1",
    "imageName": "wide-image.png"
  },
  "buttons": [
    {
      "ordering": 1,
      "type": "WL",
      "name": "Open",
      "linkMo": "https://example.com"
    }
  ]
}
```

Fields:

- `senderResourceId`: required active `kakao_sender_key` resource.
- `templateName`: required user-facing provider template name.
- `chatBubbleType`: required Brand Message type. Supported draft types are
  `TEXT`, `IMAGE`, `WIDE`, `WIDE_ITEM_LIST`, `PREMIUM_VIDEO`, `COMMERCE`,
  `CAROUSEL_FEED`, and `CAROUSEL_COMMERCE`.
- Type-specific template fields are accepted only for the selected draft type,
  such as `content`, `header`, `additionalContent`, `image`, `item`, `video`,
  `commerce`, `carousel`, `buttons`, and `coupon`.
- Local image files must be uploaded through the existing Brand Message image
  upload flow before registration. The template-registration request must not
  include `blob:`, `data:`, `sample:`, or browser `File` objects.

Rejected or stripped send-only fields:

```text
clientRequestId
recipients
recipientList
fallback
requestDate
scheduledAt
senderGroupingKey
recipientGroupingKey
reservation
sendLog
statsId
targeting
pushAlarm
unsubscribeNo
unsubscribeAuthNo
resellerCode
```

Success status: `201`.

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "brand-message",
    "senderResource": {
      "id": "kakao_resource_1",
      "provider": "nhn",
      "type": "kakao_sender_key",
      "value": "sender-key-1",
      "displayName": "@brand",
      "status": "active",
      "providerStatus": "active"
    },
    "templateCode": "BRAND_TEMPLATE_001",
    "template": {
      "id": "BRAND_TEMPLATE_001",
      "value": "BRAND_TEMPLATE_001",
      "channel": "brand-message",
      "templateCode": "BRAND_TEMPLATE_001",
      "templateName": "June promotion wide image",
      "label": "June promotion wide image - @brand",
      "ownerKey": "sender-key-1",
      "ownerLabel": "@brand",
      "providerStatus": "A",
      "providerStatusCode": "A",
      "chatBubbleType": "WIDE",
      "content": "New arrivals are ready.",
      "buttons": [
        {
          "ordering": 1,
          "type": "WL",
          "name": "Open",
          "linkMo": "https://example.com"
        }
      ],
      "requiredVariables": [],
      "variables": []
    }
  }
}
```

Rules:

- The browser calls this relay route, never the provider API directly.
- The relay resolves `senderResourceId` to the provider sender key and calls
  `POST /brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates`.
- `templateCode` is provider-returned and exposed in the success data.
- The success data returns a normalized template DTO. It does not expose the raw
  provider response envelope.
- The relay must not persist Brand Message template content, recipient values,
  fallback content, reservation metadata, grouping keys, or raw provider
  payloads locally.
- Registration is scoped to freestyle drafts. Template-mode sends must keep
  using existing approved templates instead of re-registering them.

### GET /api/templates/{channel}/{templateCode}

Fetches one usable template detail.

Path:

- `channel`: `sms` or `alimtalk`.
- `templateCode`: URL-encoded template code/id.

Query:

```text
senderResourceId=...
source=GROUP|SENDER_PROFILE
```

`source` is only relevant for AlimTalk. If omitted, sender-profile templates are
checked first, then group templates.

Success:

```json
{
  "ok": true,
  "data": {
    "channel": "alimtalk",
    "template": {
      "templateCode": "ORDER_READY",
      "channel": "alimtalk",
      "body": "Order #{orderNo} is ready.",
      "requiredVariables": ["orderNo"]
    }
  }
}
```

## Operator Sender Resource Review

### GET /api/admin/sender-resource-applications

Lists sender resource applications for operators.

Query:

```text
status=submitted|approved|rejected
resourceType=sms_send_no|kakao_sender_key
```

Both query params are optional.

Success:

```json
{
  "ok": true,
  "data": {
    "operatorUserId": "operator_1",
    "applications": [
      {
        "id": "application_1",
        "userId": "user_1",
        "resourceType": "sms_send_no",
        "requestedValue": "15446859",
        "status": "submitted",
        "evidenceFiles": [],
        "user": {
          "id": "user_1",
          "userRef": "u1ref",
          "email": "user@example.com",
          "name": "User",
          "status": "active"
        }
      }
    ]
  }
}
```

### POST /api/admin/sender-resource-applications/{id}/approve

Approves an application, creates/activates a sender resource link, deletes
approved evidence where possible, and returns the activated resource.

Request body:

```json
{
  "providerValue": "15446859",
  "displayName": "Main SMS",
  "providerStatus": "approved",
  "reviewMemo": "NHN approval completed.",
  "metadataJson": {}
}
```

Fields:

- `providerValue`: optional. Defaults to `application.requestedValue`.
- `displayName`: optional.
- `providerStatus`: optional. Defaults to `approved`.
- `metadataJson`: optional object.

Success:

```json
{
  "ok": true,
  "data": {
    "application": {
      "id": "application_1",
      "status": "approved",
      "evidenceFiles": [
        {
          "id": "evidence_1",
          "status": "deleted"
        }
      ]
    },
    "resource": {
      "id": "link_1",
      "senderResourceId": "sms_resource_1",
      "role": "owner",
      "status": "active",
      "resource": {
        "id": "sms_resource_1",
        "provider": "nhn",
        "type": "sms_send_no",
        "value": "15446859",
        "displayName": "Main SMS",
        "status": "active",
        "providerStatus": "approved"
      }
    }
  }
}
```

### POST /api/admin/sender-resource-applications/{id}/reject

Rejects an application and marks evidence for 90-day cleanup.

Request body:

```json
{
  "rejectReason": "Document mismatch.",
  "reviewMemo": "Optional operator memo"
}
```

Success:

```json
{
  "ok": true,
  "data": {
    "application": {
      "id": "application_1",
      "status": "rejected",
      "rejectReason": "Document mismatch.",
      "evidenceFiles": [
        {
          "id": "evidence_1",
          "status": "delete_pending",
          "deleteAfter": "2026-08-31T00:00:00.000Z"
        }
      ]
    }
  }
}
```

## Operator Settlement

### GET /api/admin/settlement-runs

Lists settlement runs.

Query:

```text
status=running|succeeded|failed|finalized
```

`status` is optional.

Success:

```json
{
  "ok": true,
  "data": {
    "operatorUserId": "operator_1",
    "runs": [
      {
        "id": "run_1",
        "startReceiveDate": "2026-06-01T00:00:00.000Z",
        "endReceiveDate": "2026-06-01T23:59:59.000Z",
        "status": "succeeded",
        "requestedBy": "operator_1",
        "startedAt": "2026-06-02T00:00:00.000Z",
        "finishedAt": "2026-06-02T00:01:00.000Z",
        "finalizedBy": null,
        "finalizedAt": null,
        "errorMessage": null,
        "createdAt": "2026-06-02T00:00:00.000Z"
      }
    ]
  }
}
```

### POST /api/admin/settlement-runs

Creates and runs settlement aggregation from NHN result data.

Request body:

```json
{
  "startReceiveDate": "2026-06-01T00:00:00.000Z",
  "endReceiveDate": "2026-06-01T23:59:59.000Z"
}
```

Rules:

- Both dates are required.
- `startReceiveDate` must be before `endReceiveDate`.
- Aggregation queries NHN in one-day chunks.

Success status: `201`.

Success:

```json
{
  "ok": true,
  "data": {
    "run": {
      "id": "run_1",
      "startReceiveDate": "2026-06-01T00:00:00.000Z",
      "endReceiveDate": "2026-06-01T23:59:59.000Z",
      "status": "succeeded",
      "errorMessage": null
    },
    "summaries": [
      {
        "id": "summary_1",
        "runId": "run_1",
        "billingAccountId": "billing_1",
        "userId": "user_1",
        "channel": "sms",
        "usageType": "all",
        "deliveredCount": 42,
        "createdAt": "2026-06-02T00:00:00.000Z"
      }
    ]
  }
}
```

If provider aggregation fails, the endpoint still returns a run detail with
`run.status: "failed"` and an empty `summaries` array.

### GET /api/admin/settlement-runs/{id}

Returns a run and its summaries.

Success data:

```json
{
  "run": {},
  "summaries": []
}
```

### POST /api/admin/settlement-runs/{id}/finalize

Finalizes a succeeded run.

Rules:

- Only `succeeded` runs can be finalized.
- Already finalized or failed/running runs return validation errors.

Success data:

```json
{
  "run": {
    "id": "run_1",
    "status": "finalized",
    "finalizedBy": "operator_1",
    "finalizedAt": "2026-06-02T00:10:00.000Z"
  },
  "summaries": []
}
```

## Frontend Implementation Notes

Generate `clientRequestId` on the client before every send. Use
`crypto.randomUUID()` where available.

Do not implement local message history by storing send request bodies. The logs
screen should fetch from NHN through the relay.

Do not retry an `unknown_after_provider_call` send automatically. The safe user
flow is:

1. Show an indeterminate provider status.
2. Poll `GET /api/messages/status`.
3. If still unknown, ask the user before any manual resend.

Use sender resource type to decide which form controls are enabled:

- `sms_send_no`: SMS/LMS/MMS send and SMS templates.
- `kakao_sender_key`: AlimTalk send and AlimTalk templates.

Operator-only endpoints should be hidden unless the current user is known to be
an operator. The API still enforces operator access.

## Local Verification

Mock-backed server tests:

```bash
npm run test:server
```

Full handoff verification:

```bash
npm run lint && npm run test:server && npm run build
```

Local API smoke test:

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

The CLI fallback shown above is for non-production smoke testing only. Normal
browser flows should sign in through Clerk and rely on Clerk session cookies.
The smoke test requires valid `DATABASE_URL`, NHN credentials, and active sender
resource records in the database.
