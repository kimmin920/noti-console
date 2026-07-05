# PRD: Message Send API Integration

## Goal

Make `http://localhost:3000/message-send` send real messages through the existing relay APIs instead of showing a local-only success toast.

The UI composition already exists. This work connects the current SMS and AlimTalk composer state to server-backed reads and mutations while preserving the product-console layout.

## Scope

In scope:

- Load the current user's active sender resources from `GET /api/sender-resources`.
- Load usable SMS and AlimTalk templates from the template catalog APIs for the selected sender resource.
- Send non-advertising SMS/LMS/MMS through `POST /api/messages/sms/send`.
- Send AlimTalk through `POST /api/messages/alimtalk/send`.
- Show actionable loading, validation, success, provider-unknown, provider-rejected, and auth/resource error states.
- Keep server state in TanStack Query and screen-local workflow state in React.
- Avoid persisting recipient numbers, message bodies, rendered AlimTalk content, and template parameters outside the send request lifecycle.

Out of scope:

- New visual design for the message send page.
- New database schemas, migrations, external API routes, auth routes, or provider clients.
- Audience/segment backend resolution.
- Advertising SMS/MMS sends. The current server client routes SMS through `/sender/sms` and `/sender/mms`, not NHN's advertising endpoints, so `isAdvertisement` sends must be blocked until backend support is explicitly added.
- Brand Message sending. There is no brand-message send route in the current server contract, so the Brand Message tab must not pretend to send through the relay until a server API exists.
- Production E2E infrastructure unless a scripted runner is added separately.

## Users

- Sender users with active `sms_send_no` or `kakao_sender_key` resources.
- Operators validating the send workflow and provider responses.

## Current State

- `src/app/message-send/page.jsx` routes to `ConsoleRoute` with the default console page.
- `src/features/console/ConsolePages.jsx` owns the current message-send state and `sendMessage()` only shows a toast.
- `SmsSendForm`, `AlimtalkSendForm`, and related previews already capture most composer state.
- Server routes already exist for SMS and AlimTalk sends.
- Sender resources and template catalog APIs already exist.
- `@tanstack/react-query` is not installed yet, so API-backed UI work must add the dependency and a provider.

## Workflow State Classification

Apply these state models before choosing a loading or error treatment:

- Sender-resource and template reads are async data loading states.
- Missing sender resources and missing templates are empty or permission-limited states, not provider failures.
- Failed sender-resource or template reads are degraded data states because the primary send workflow cannot be completed accurately.
- SMS and AlimTalk sends are explicit submit actions with a pending single change. Preserve the user's form values on failure.
- Local form issues are validation states and should be shown near the relevant control or send action.
- Provider rejection is a failed submit action.
- `unknown_after_provider_call` is a provider-result uncertainty state. The request may have reached NHN, so the UI must not present it as a normal retryable failure.
- Auth and sender-resource role failures are permission states. Do not hide the main page shell or navigation because of these errors.

## Loading And Error UX Rules

These rules are adapted from Primer Product UI loading, empty-state, notification, degraded-experience, and saving guidance. They define behavior only; this project should continue using its existing UI primitives.

### Loading

- First try to make the request fast. Add loading UI only when users would otherwise think the process silently failed.
- Under about 1 second, avoid showing a loading indicator that flashes.
- For 1-3 second waits, use an indeterminate in-context loading state.
- For waits longer than about 3 seconds, include plain progress text that explains what is being loaded or checked. Use a determinate progress indicator only if real progress is known.
- For waits longer than about 10 seconds, avoid blocking unrelated interactions. Treat status lookup or provider confirmation as background work when possible.
- Place loading states closest to the affected content:
  - Sender resources: inside or just above the composer controls that depend on sender resources.
  - Templates: inside the template picker area, not as a full-page blocker.
  - Send mutation: on or beside the `발송하기` action and in a nearby status area.
  - Status polling: near the last send result, not as a page overlay.
- For large content regions, use a stable placeholder that preserves layout. For small adjacent fields, prefer one grouped loading message instead of many separate spinners.
- Show already-loaded useful data incrementally. For example, a loaded SMS sender resource should remain usable while AlimTalk templates are still loading.
- Loading indicators must have accessible status text. Do not rely on a spinner alone.
- Avoid excessive announcements. A collection of loading rows should have one loading announcement, not one per placeholder.

### Errors, Empty States, And Degraded Data

- Distinguish empty from error:
  - No active SMS sender resource: empty setup state with the next step.
  - No approved template for a selected sender: empty catalog state with the next step.
  - API request failed: degraded/error state with retry if retrying is meaningful.
  - `UNAUTHORIZED` or `FORBIDDEN`: permission state with auth/resource context.
- Error copy must be concise, specific, and non-technical. Use relay error codes only when they help diagnostics; do not make obscure codes the main message.
- If the user can recover, show the recovery path near the error. Examples: retry template load, select another sender, sign in, add sender resource, remove segment recipients.
- If there is no user recovery path, explain the state without inventing an action.
- Do not render controls with missing critical data as if they are usable. Replace the affected region with a short error or empty state.
- Do not hide a critical workflow control without explanation. If `발송하기` cannot send because a required resource is unavailable, keep the reason visible near the action.
- Avoid stacking messages. Prefer one section-level message plus targeted inline validation over many repeated warnings.
- Do not use tooltip-only explanations for required information or disabled/non-functional actions.
- Do not show fake local success for server-backed workflows. Success messaging is only valid after the relay mutation returns a successful envelope.

### Submit And Mutation Feedback

- The send action is explicit submit behavior. Preserve all draft values if the mutation fails.
- Prevent duplicate sends while a send mutation is pending. The pending state must be visually clear and announced to assistive technology.
- Keep validation errors close to the invalid workflow:
  - Missing concrete recipients near recipient selection or the send action.
  - Missing title for LMS/MMS near SMS content settings.
  - Missing AlimTalk variables near the variable editor or template area.
  - Missing fallback SMS resource near the fallback control.
- For multiple validation errors, show one summary near the send action and keep field-level messages discoverable.
- Do not automatically retry sends. Provider timeout or `unknown_after_provider_call` must route to status lookup instead of blindly sending again.
- For successful sends, avoid overusing success UI if the result area clearly changes. If there is no visible result area yet, show a concise success toast/status with safe metadata only.
- For provider-unknown states, show an ongoing or uncertain status and a lookup path. Do not label it as delivered or failed.

### Accessibility

- Loading, success, error, validation, and provider-unknown state changes must be announced with a status or live region when they are not obvious from focus or navigation.
- When a blocking validation summary appears after submit, move focus to the summary or first actionable error.
- Keep keyboard focus predictable after retries and successful sends.
- Do not rely on color alone for success, warning, unavailable, or critical states.
- Existing buttons, links, and retry controls must have descriptive accessible names.

## Required Work Before A Message Can Be Sent

### 1. Query Foundation

Add a small frontend API layer for relay JSON envelopes:

- `src/features/console/messageSend/apiClient.js`
- `src/features/console/messageSend/queryKeys.js`
- `src/features/console/messageSend/queries.js`

The API client must:

- Use same-origin `fetch`.
- Send `content-type: application/json` for mutations.
- Parse `{ ok, data, error }` envelopes.
- Throw normalized errors with `code`, `message`, `source`, `retryable`, and `state`.
- Never log request bodies, recipient numbers, rendered content, or template parameters.

Add an app-level Query Client provider without converting the project to TypeScript.

### 2. Sender Resource Resolution

The send screen must read `GET /api/sender-resources` and derive:

- SMS resources where `resource.type === "sms_send_no"`.
- AlimTalk resources where `resource.type === "kakao_sender_key"`.
- Active resources only, using the API response's filtered `resources` list.

The current static sender options can remain as non-production fallback only if the API is unavailable in development, but the real send button must require a server-backed `senderResourceId`.

Map sender options so selected form values resolve unambiguously to server resources:

- SMS sender options should use `value: resource.id` and keep the provider phone number separately, for example `phoneNumber: resource.value`.
- AlimTalk sender profile options should use `value: resource.id` and keep the provider sender key separately, for example `senderKey: resource.value`.
- SMS fallback options should use `value: resource.id` and keep the provider phone number separately.
- Display labels and previews may show provider values, but send payloads must use server resource ids.
- Template selection must not overwrite the selected SMS sender resource id with `template.sendNo`.

Empty states:

- No SMS resource: make SMS send unavailable, keep the reason visible, and point the user to sender-resource setup.
- No Kakao resource: make AlimTalk send unavailable, keep the reason visible, and point the user to Kakao sender setup.
- `UNAUTHORIZED`: show sign-in/auth error state, not a fake local success.
- `FORBIDDEN`: show sender-resource access error.
- Sender-resource loading and errors must follow the Loading And Error UX Rules above.

### 3. Template Hydration

Load templates only after the relevant sender resource is selected:

- `GET /api/templates/sms?senderResourceId=...`
- `GET /api/templates/alimtalk?senderResourceId=...`

Map API templates into the existing form option shape:

- SMS: `value`, `templateId`, `templateCode`, `templateName`, `label`, `body`, `title`, `sendType`, `variables`.
- AlimTalk: `value`, `templateCode`, `templateName`, `label`, `body`, `content`, `buttons`, `quickReplies`, `requiredVariables`, `variables`, `source`, `ownerKey`, `ownerLabel`.

Changing the selected sender resource must reset or reselect templates so the screen never sends a template that is not available for that sender.

Template loading and errors must follow the Loading And Error UX Rules above. A failed template read should not clear already-valid sender-resource context.

The preview components must receive the same API-backed sender and template option lists as the forms. The preview must not fall back to static defaults when the production send form is server-backed.

### 4. Recipient Resolution

The server send APIs require concrete recipient phone numbers.

MVP sendable recipients:

- Manual recipients from `RecipientSelect` where `type === "manual"` and `value` is a phone number.
- Server-backed contact options where `detail`, `phone`, or `value` contains a phone number, only after a real contact source is introduced.

Recipient UI behavior:

- Keep the recipient selector usable even when there are no saved recipients.
- When there are no server-backed contacts or segments, users must still be able to type a phone number manually and send to that direct recipient.
- If the empty recipient area needs an action, use a "수신자 추가하기" style action that navigates to the audience/contact screen.
- Do not show default/mock `RecipientSelect` contacts in the production message-send route.

Not expandable until audience APIs exist:

- `all`
- segment values such as `product-updates`
- any option with a count but no concrete phone number

If a user selects a segment, "all", or another non-concrete recipient target before audience resolution exists, the send action must show validation explaining that this integration currently requires a direct phone number. It must not expand mock segment counts into fake sends.

Until a real contact API exists, the production route should treat only manual phone-number recipients as sendable.

### 5. SMS Payload Builder

Build `POST /api/messages/sms/send` payloads from `SmsSendForm` state:

```json
{
  "clientRequestId": "uuid",
  "senderResourceId": "server-resource-id",
  "channel": "sms | lms | mms",
  "templateCode": "optional-template-id",
  "title": "required-for-lms-or-mms",
  "body": "message body",
  "recipients": [
    {
      "recipientNo": "010-1234-5678",
      "templateParameter": {}
    }
  ],
  "requestDate": "optional NHN request date",
  "attachFileIdList": []
}
```

Rules:

- Generate a fresh UUID per distinct send attempt.
- Use `senderResourceId` from the active SMS resource, not the displayed sender phone number.
- Determine `channel` from the form's message type: SMS, LMS, or MMS.
- Include `title` for LMS/MMS.
- If `scheduledAt` is present, convert it to the documented NHN relay `requestDate` format before sending. Do not send natural-language schedule text.
- Map template variables to each recipient's `templateParameter`.
- Do not send browser-only attachment preview data. MMS can only include server/provider file ids that are already uploaded.
- If `isAdvertisement` is true, block the send with validation until the server supports NHN advertising SMS/MMS endpoints. Do not fake advertising support by only adding `(광고)` text on the frontend.

### 6. AlimTalk Payload Builder

Build `POST /api/messages/alimtalk/send` payloads from `AlimtalkSendForm` state:

```json
{
  "clientRequestId": "uuid",
  "senderResourceId": "server-kakao-resource-id",
  "templateCode": "ORDER_READY",
  "recipients": [
    {
      "recipientNo": "010-1234-5678",
      "templateParameter": {},
      "buttons": [],
      "quickReplies": []
    }
  ],
  "fallback": {
    "enabled": true,
    "smsSenderResourceId": "server-sms-resource-id",
    "resendType": "SMS",
    "resendContent": "fallback body"
  },
  "requestDate": "optional NHN request date"
}
```

Rules:

- Use the selected Kakao sender resource's server id as `senderResourceId`.
- Use the selected template's `templateCode`.
- Include template parameters from the variable editor.
- Include template buttons and quick replies when they come from the selected template/API data.
- If SMS fallback is enabled, resolve a server-backed SMS sender resource id. Do not send fallback when no SMS resource is available.
- If `scheduledAt` is present, convert it to the documented NHN relay `requestDate` format before sending. Do not send natural-language schedule text.

### 7. Mutation And Result Handling

Use TanStack Query mutations for sends.

Before mutation:

- Validate sender resource, template, body, required variables, concrete recipients, fallback, and schedule.
- Prevent duplicate sends while the active mutation is pending, with clear in-context pending feedback.
- Keep drafts local; do not add a draft persistence API.

After mutation:

- `accepted_by_provider`: show accepted state with channel, recipient count, and lookup metadata safe for display.
- `unknown_after_provider_call`: show provider result unknown and expose a status lookup path using returned `lookup`.
- `rejected_by_provider`: show provider rejection message without echoing raw recipient/content.
- `LOCAL_VALIDATION_FAILED`: show the relay validation message next to the relevant workflow where possible.
- `UNAUTHORIZED` and `FORBIDDEN`: show auth/resource state and do not retry automatically.
- Follow the Loading And Error UX Rules above for message placement, retry behavior, focus, and announcements.

Optional final hardening:

- Poll `GET /api/messages/status` for `accepted_by_provider` and `unknown_after_provider_call` if the returned `lookup` is present.
- Stop polling on found, unknown terminal state, user tab change, or component unmount.

### 8. State Ownership

- TanStack Query owns sender resources, templates, sends, loading, errors, invalidation, and optional status polling.
- React local state owns active tab and form values.
- If the send workflow becomes complex, use a pure reducer with explicit actions and commands.
- Do not mirror query data into reducer state.
- Do not use `useEffect` to copy query results into form state. Use selectors, derived options, and explicit user actions.

### 9. Security And Data Handling

- Do not store sent bodies, recipient numbers, rendered AlimTalk content, or template parameters in local storage, analytics, logs, or durable client state.
- Do not expose NHN app keys, secret keys, sender grouping keys, or recipient grouping keys.
- Do not document or rely on `x-relay-user-id` for browser auth.
- Keep Clerk session-cookie authentication as the browser contract.

## Acceptance Criteria

For every implementation harness step:

```bash
npm run lint && npm run build
```

Before considering the API connection complete:

- SMS can send to a manually entered phone number when an active SMS sender resource exists.
- LMS/MMS validation prevents missing title or unsupported browser-only attachments.
- Advertising SMS/MMS is visibly unavailable until a server advertising endpoint is added.
- AlimTalk can send to a manually entered phone number when an active Kakao sender resource and approved template exist.
- AlimTalk fallback requires an active SMS sender resource.
- Direct manual phone-number recipients can be sent even when no saved recipient records exist.
- Segment, "all", and default/mock contact recipients are not expanded into send payloads until a real audience/contact resolution API exists.
- Auth, forbidden, empty resource, provider rejection, and provider-unknown states are visible.
- Loading, validation, empty, degraded, permission, pending, success, and provider-unknown states follow the Loading And Error UX Rules.
- The Brand Message tab no longer shows fake relay success.

## Harness Phase

Implementation should run through `phases/3-message-send-api-integration`.

Recommended sequence:

1. Add Query provider, API client, query keys, and hooks.
2. Hydrate sender resources and templates into the existing forms.
3. Connect SMS send mutation and payload validation.
4. Connect AlimTalk send mutation and fallback validation.
5. Harden result/status handling and docs.

## Open Questions

- Should the first production release support only manual recipients, or should an audience/contact API be added before release?
- Should SMS MMS image upload be added as a separate route before enabling MMS sends with browser-selected files?
- Should Brand Message receive its own relay API, or should the current tab be hidden until server support exists?
