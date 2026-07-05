# PRD: Sender Resource Application UI

## Goal

Create a dedicated sender resource application experience for users who need to add SMS sender numbers and Kakao sender channels before sending messages.

This is a workflow page, not a modal. Sender-number registration requires identity evidence, document preparation, user confirmation/signature, operator review, NHN registration verification, and activation as a usable sender resource. Kakao channel connection also needs a multi-step request and verification flow.

## Product Decision

Use `설정 > 발신 수단 관리` as the management surface and separate application pages for each resource type:

- `/settings?tab=sender-resources`: management list, default selection, status, limits, add actions.
- `/settings/sender-resources/sms/new`: SMS sender-number application workflow.
- `/settings/sender-resources/kakao/new`: Kakao channel connection workflow.

Do not implement sender resource application as a modal. The workflow needs progress, document state, file state, validation summaries, back navigation, and later draft/resume behavior.

## Sources And Current Contracts

Current app contracts:

- `GET /api/sender-resources`: active user sender resources and applications.
- `POST /api/sender-resources/sms/applications`: SMS sender number application. Supports `application/json` and `multipart/form-data`.
- `POST /api/sender-resources/kakao/connect/request`: Kakao sender registration request.
- `POST /api/sender-resources/kakao/connect/verify`: Kakao token verification and activation.
- `userSenderResources.isDefault` exists in DB, but no user-facing default selection API exists yet.

Policy references checked on 2026-06-03:

- [NHN Cloud SMS console guide](https://docs.nhncloud.com/ko/Notification/SMS/ko/console-guide/): sender number registration and allowed sender-number policy.
- [NHN Cloud Notification Hub SMS policy](https://docs.nhncloud.com/ko/Notification/Notification%20Hub/ko/service-policy-and-precondition/sms/): sender number owner authentication, evidence documents, consent form, communication service certificate, employment certificate masking and recency rules.

## Users

- Workspace sender: needs to add a sender number/channel before sending.
- Workspace operator/admin: later reviews submitted documents and approves/rejects/supplement-requests.
- Support/operator: later diagnoses NHN registration or verification mismatch.

## Scope

In scope for the first UI phase:

- Settings management tab UI for sender resources.
- Page navigation from add buttons to dedicated application pages.
- SMS sender-number application page layout and step structure.
- Kakao channel application page layout and step structure.
- Local-only validation and review summaries for visible UI fields.
- Loading, error, empty, and disabled states using existing product-console primitives.
- Clear placeholder boundaries for APIs not yet implemented.

Out of scope for the first UI phase:

- Final document generation/signing.
- Real file upload submission.
- Operator review screens.
- Default sender update API.
- New DB migrations or schema expansion.
- NHN provider calls beyond existing API route contracts.
- Fully automated evidence classification.

## Design And Implementation Rules

- Do not use the `frontend-design` skill.
- Do not infer styles from screenshots alone.
- Reuse existing app source patterns:
  - Settings management layout: `usage-section`, `usage-copy`, `usage-table`, `limit-row`.
  - Menu empty action style: `SmsFallbackSelect` classes.
  - Console page shell: `ConsoleRoute`, `MessagingConsole`, `ConsolePages`.
- Keep this a product console, not a marketing page.
- Do not introduce TypeScript.
- Use existing UI primitives before adding new ones.

## Information Architecture

### Settings Management

`설정 > 발신 수단 관리` contains two resource sections:

- `발신번호`
  - Left: explanation and `번호 추가` button.
  - Right: usable sender numbers, default badge/action, status, limit slot.
- `카카오 채널`
  - Left: explanation and `채널 추가` button.
  - Right: usable channels, default badge/action, status, limit slot.

Management actions:

- `번호 추가` navigates to `/settings/sender-resources/sms/new`.
- `채널 추가` navigates to `/settings/sender-resources/kakao/new`.
- `기본 설정` is visible but disabled or placeholder until default API exists.

### SMS Sender Number Application Page

Route: `/settings/sender-resources/sms/new`

Recommended workflow:

1. 발신번호 입력
2. 명의 유형 선택
3. 필요 서류 준비
4. 서류 확인/서명
5. 증빙 업로드
6. 제출 전 검토

The page should show progress and a persistent summary of what is complete, missing, or blocked.

### Kakao Channel Application Page

Route: `/settings/sender-resources/kakao/new`

Recommended workflow:

1. 채널 정보 입력
2. 인증 요청
3. 토큰 검증
4. 채널 활성화 확인

The page should clearly distinguish provider request pending, user action pending, provider verification failure, and activation success.

## SMS Sender Number Data Requirements

Minimum first implementation:

- `sendNo`: normalized sender phone number.
- `ownerType`: UI-level sender number ownership type.
- `evidenceFiles`: uploaded evidence files passed to current relay API.

Future server expansion candidates:

- `ownerType`
- structured document types
- generated document IDs
- signature status
- review/supplement metadata
- NHN registration sync status

Ownership type options should support the official policy model even if the first server contract stays simpler:

- 법인 명의 번호
- 대표자/임직원 번호
- 타사 번호
- 타인 번호

The current external example only had `COMPANY` and `EMPLOYEE`, but this product should not lock the UI language to those ambiguous names.

## SMS Evidence Requirements

Baseline document checklist:

- 통신서비스 이용증명원
- 이용승낙서 when required by ownership type
- 재직증명서 for representative/employee number where applicable
- 타사 사업자등록증 for third-party number
- 관계 확인 문서 for third-party number
- 신분증 사본 only if a later policy/legal review confirms it is required
- 추가 보완 서류 for supplement requests

Document guidance:

- Communication service certificate must be recent and unmasked according to NHN policy.
- Employment certificate must include issue date and seal; resident registration number back digits must be masked.
- Sensitive personal data handling must be explained before upload.
- The UI should prefer generated/templated documents where possible, so users sign or confirm rather than manually constructing every document.

## File Upload Rules

Initial UI should align with the known external implementation unless current server code states otherwise:

- Max files: 7
- Max file size: 5 MB each
- Allowed extensions: `.pdf`, `.jpg`, `.jpeg`, `.png`
- Use `multipart/form-data` for production submission.
- Do not expose public URLs, signed URLs, arbitrary external object locations, or raw storage keys in browser UI.

## Sender Number Validation

Validate before submission:

- Strip hyphens/spaces and normalize to digits.
- Domestic sender number length: 8 to 11 digits.
- Reject impossible or explicitly disallowed ranges where known.
- Surface validation near the number field and in a final review summary.

Do not rely on client validation alone. Server validation must be added before production submission is considered complete.

## Status Flow

Application status model:

- `draft`
- `submitted`
- `supplement_requested`
- `approved`
- `rejected`
- `canceled`

MVP UI behavior:

- Draft/in-progress: user can continue editing.
- Submitted: show read-only submitted state and expected review next step.
- Supplement requested: show requested documents and allow resubmission.
- Approved: show linked active sender resource if available.
- Rejected: show reason and allow new/resubmission path only if policy allows.

Duplicate behavior:

- Existing submitted application for the same normalized number should block duplicate submission.
- Existing approved sender number should block duplicate application.
- Supplement/rejected states may allow resubmission.

## Loading And Error Rules

- Loading states stay in the affected section, not full-page overlays.
- Submit pending state preserves all field values.
- API errors show concise recovery guidance and retry only when meaningful.
- Provider uncertainty must not show success.
- Auth failures keep the console shell visible when possible.
- File validation errors must identify file name, field, and reason.

## Accessibility

- Application progress must be readable by screen readers.
- Step transitions should move focus to the new step heading or validation summary.
- File upload controls need descriptive labels and accepted file guidance.
- Required document state cannot rely on color alone.
- Review summary must be keyboard navigable.

## API And Backend Gaps

Required before full production:

- Server support for `ownerType` and structured evidence document types.
- Server-side phone number normalization and validation.
- Default sender resource API:
  - `PATCH /api/sender-resources/{linkId}/default`
  - Must enforce one default per resource type and user.
- Application detail route for draft/resume/review:
  - `GET /api/sender-resources/applications/{id}`
- Supplement resubmission API.
- Operator review UI/API alignment.
- Optional generated document/signature workflow.

Can be done in UI-first phase:

- Dedicated page routing.
- Stepper/page skeleton.
- Local form state.
- Document checklist rendering.
- File picker UI and client validation.
- Review page with disabled submit or mock submit boundary.

## Proposed Harness Phase

Phase: `4-sender-resource-application-ui`

Step 0: PRD and route contract

- Read `AGENTS.md`, `docs/FRONTEND_HARNESS.md`, `docs/NHN_RELAY_FRONTEND_API.md`, `src/features/console/ConsolePages.jsx`.
- Add or update this PRD.
- Acceptance: `npm run lint && npm run build`.

Step 1: Settings navigation and application pages

- Make add buttons navigate to dedicated pages.
- Keep settings nav active on child pages.
- Add placeholder application pages.
- Acceptance: `npm run lint && npm run build`.

Step 2: SMS application UI skeleton

- Add step layout, number input, ownership type selection, document checklist, file upload shell, review summary.
- No production submission yet.
- Acceptance: `npm run lint && npm run build`.

Step 3: Kakao channel application UI skeleton

- Add channel info form, request/verify state layout, pending/success/error surfaces.
- No provider mutation unless current API contract is explicitly connected in that step.
- Acceptance: `npm run lint && npm run build`.

Step 4: API wiring and hardening

- Connect available relay APIs only after server contract gaps are accepted.
- Add invalidation for `GET /api/sender-resources`.
- Acceptance: `npm run lint && npm run build`.

## Acceptance Criteria For This PRD

- The product direction uses dedicated pages, not modal-only application flows.
- The UI is compatible with current settings layout.
- SMS and Kakao workflows are separated but remain under one sender resource domain.
- Official NHN sender number policy constraints are represented at the UX requirement level.
- Current backend gaps are explicit and not hidden behind fake success.
