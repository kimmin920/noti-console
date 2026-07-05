# Source Reference Harness Guide

Use this guide when a harness phase ports behavior from an existing source
application, compiled bundle, screenshot-backed page, or copied local reference
such as `../solapi-alim-talk`.

The goal is not just to copy visible render branches. The harness must preserve
the state transitions, reachable prop combinations, validation wiring, and
negative cases that make the source behavior correct.

## Why This Exists

Phase `18-alimtalk-template-source-port` exposed a harness gap:

- The preview renderer was copied from source branches.
- A test passed `highlightThumbnailImageId` and `highlighThumbnailImageUrl`
  together and asserted that both placeholder and image rendered.
- The source page's container only passed the thumbnail URL for that flow.
- The implementation's file input created the impossible combined state, so
  the placeholder remained after an image was loaded.
- Image metadata validation existed as a pure function test, but the harness did
  not prove that invalid files surfaced validation through the actual UI path.

Phase `19-alimtalk-source-fidelity-hardening` exposed the next harness gap:

- The hardening pass correctly fixed the highlight thumbnail state matrix.
- It narrowed its scope to that one interaction and did not inventory every
  source-required control in the same template-type section.
- The source `IMAGE` template path always renders an image upload form, but the
  implementation still had only a renderer placeholder toggle.
- The harness accepted preview and validation tests without proving that
  selecting `IMAGE` creates the source-backed upload control, checklist,
  uploaded-image preview data path, and required-image submit validation.

These are the failure modes this guide is meant to prevent: source evidence was
present, but the harness either tested an unreachable state shape or never made a
source-required user control part of the contract.

## Required Source Contract

Every source-reference phase must create a source contract before product
implementation. The contract must include these sections:

- Source files and immutable hashes.
- Render branches and style tokens.
- Data shape for each source component.
- Source control inventory for every template-type gated UI section.
- Container-to-renderer prop mapping.
- State transition map from user event to stored state to rendered props.
- Reachable state matrix for every optional branch.
- Validation owner map: pure rule, UI owner, and submit/blocking path.
- Out-of-scope boundaries split by persistence/API work versus local UI work.

Do not treat a renderer prop list as the complete contract. If the source uses a
container or state owner before the renderer, that mapping is authoritative for
which prop combinations can actually happen.

## Source Control Inventory Gate

Before implementation, every source-reference phase must inventory the controls
that are reachable from each user-visible mode, tab, toggle, or template type.
This inventory is separate from the preview state matrix.

For each control, record:

- Source file and line evidence that renders or initializes the control.
- User-visible label, role, input type, disabled state, and accepted values.
- Visibility rule, including whether a collapse/accordion is forced open for a
  mode.
- User event that changes state.
- State key written by the source container.
- Renderer or validation path that consumes the state.
- DOM assertion or browser QA artifact that proves the control exists or is
  intentionally absent.

Required source controls are a completion veto. If a source mode renders a local
control that does not require provider credentials, network transfer, storage, or
database persistence, the harness step cannot mark the phase complete until that
control has implementation evidence and DOM/UI path evidence.

Example AlimTalk control inventory row:

| Mode | Required control | Source evidence | State written | Harness proof |
| --- | --- | --- | --- | --- |
| `IMAGE` | image file upload labeled `알림톡 이미지 업로드 (JPEG, PNG)` with checklist | `KakaoTemplateImageUploadContainer` initializes FilePond; `CreateKakaoTemplateForm` forces the image collapse open | `imageFileData`, image errors/checklist | Browser selects `이미지첨부형`, asserts a file upload control exists, uploads valid and invalid files, and verifies preview/validation |

The absence of a required control must be treated as a failed source-reference
port, even if renderer-only tests still pass.

## Reachable State Matrix

For each preview or conditional branch, the step must document which states are
valid, invalid, or unreachable through the source UI.

Example matrix shape:

| State | Source path | Expected render | Harness test |
| --- | --- | --- | --- |
| thumbnail URL only | file/upload state maps to preview URL | image only | positive + negative assertion |
| thumbnail id only | source renderer supports placeholder state | placeholder only | SSR/unit test |
| id plus URL | not produced by source container | not a valid app state | do not use as a positive fixture |

If a test uses a state that the source container cannot produce, the test must
say why. Otherwise, reject that test as arbitrary.

## Positive And Negative Assertions

Source-reference tests must assert both:

- What must render.
- What must not render in the same state.

For preview branches, include negative assertions for mutually exclusive states:

- Image loaded means image placeholder is absent.
- Direct URL wins over local file data and placeholder.
- Disabled or unchecked section values do not leak into preview.
- Template-type gated fields do not render in other template types.

A `toContain`-only contract is not enough. It can protect incorrect combined
states.

## UI Path Proof

Pure functions are not enough when users interact with a rendered form.

For each source-backed validation rule, require evidence for all applicable
layers:

| Rule | Pure test | UI path proof | Manual/browser artifact |
| --- | --- | --- | --- |
| file too small | validator returns message | file input sets metadata and alert shows | screenshot or DOM snapshot |
| invalid text field | validator returns message | typing value shows local validation | screenshot or DOM snapshot |
| submit-blocking rule | validator returns message | submit/confirm path blocks and surfaces message | screenshot or DOM snapshot |

If the repository lacks upload persistence or provider APIs, local file
selection and metadata validation can still be in scope. Only network transfer,
storage, provider registration, credentials, and persistence should be marked
out of scope.

Submit-blocking validation must be checked through the form surface when the
source blocks submission. For example, if `IMAGE` templates require
`imageFileData`, the harness must prove both the pure validation message and the
user-visible error produced by trying to validate/submit without an uploaded
image.

## Out-of-Scope Rules

Do not use broad out-of-scope language. Split boundaries precisely:

- In scope: source-backed local controls, local state transitions, preview
  wiring, local file metadata reads, local validation, disabled states, helper
  copy, and visible errors.
- Out of scope: provider upload, provider registration, credentials, database
  persistence, remote catalogs, and API contracts not present in this repo.

If local behavior is source-backed and does not require an external API, the
harness should not omit it under an "upload/API out of scope" label.

## Step Design Pattern

Use this split for source-reference frontend phases:

1. Source map and evidence lock.
   - Include source hashes, loading chain, state owners, and large-file parsing
     strategy.
2. Source contract.
   - Extract render branches, style tokens, source control inventory, prop
     mapping, state transitions, reachable state matrix, and validation owner
     map.
3. Renderer/component implementation.
   - Tests must include positive and negative assertions for each branch.
4. Pure validation implementation.
   - Tests pin source messages and boundary values.
5. UI integration.
   - Wire controls to state and preview. Browser QA must drive source-backed
     user events, not just render the page.
   - Prove every required source control exists in the DOM for the modes where
     the source shows it, including file inputs/upload widgets and checklists.
6. Edge-flow hardening.
   - File inputs, mutually exclusive preview states, disabled sections,
     template-type switching, and reset behavior.
7. Final source-fidelity QA.
   - Verify every source contract row has implementation evidence and UI path
     evidence, or a precise out-of-scope reason.

## Acceptance Criteria Additions

Add commands and checks like these to relevant steps:

```bash
npm run test:server -- src/server/__tests__/{feature}*.test.js
npm run lint && npm run build
test -s phases/{phase}/source-contract.md
test -s .omo/evidence/{phase}/final-source-fidelity.md
```

For UI path proof, include a concrete browser script or Playwright scenario in
the step instructions. The scenario must name the control, user event, expected
DOM text, and expected absence of mutually exclusive elements.

Example:

```text
Drive the real page or playground:
- select ITEM_LIST
- enable highlight
- enter title and description
- upload a valid 108x108 PNG
- assert highlight image is visible
- assert thumbnail placeholder is absent
- upload or simulate invalid metadata
- assert the source validation message is visible
```

Add static guard checks when the bug class is "required control omitted":

```bash
node -e 'const fs=require("fs"); const s=fs.readFileSync("src/features/console/alimtalkTemplates/AlimtalkTemplateAdvancedSections.jsx","utf8"); if (!s.includes("type=\"file\"") || !s.includes("imageFileData")) throw new Error("source-required image upload control/state path missing");'
```

Static guards do not replace browser QA; they catch omissions before the agent
can rely on a renderer-only test.

## Final QA Checklist

Before a source-reference phase is complete, verify:

- No fixture uses an unreachable source state unless documented as defensive.
- Every preview branch has at least one negative assertion.
- Every source-required control has implementation evidence and DOM/UI path
  evidence for each mode where the source renders it.
- Every validation rule has pure-rule and UI-path evidence, or a precise
  out-of-scope reason.
- Browser QA drove source-backed user events, including at least one edge path.
- Screenshot or DOM artifacts exist for important visual and validation states.
- Out-of-scope items distinguish local UI from provider/API/persistence work.
- The final audit maps implementation rows to source line evidence and test/QA
  evidence, not just source line evidence.

## Step Prompt Snippet

When writing a source-reference step, include this paragraph:

```text
This is source-reference work. Follow `docs/SOURCE_REFERENCE_HARNESS.md`.
Do not stop at renderer branches. Extract the source control inventory,
source-reachable state combinations, container-to-renderer prop mapping,
user-event state transitions, and validation UI paths. Tests must assert both
required elements and mutually exclusive elements that must be absent. Browser QA
must drive the real UI path for each source-required control and for at least one
positive and one negative edge case for each source-backed interactive section.
```
