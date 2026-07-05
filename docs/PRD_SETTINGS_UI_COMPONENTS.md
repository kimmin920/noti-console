# PRD: Settings UI Components

## Goal

Extract reusable settings-surface components from the Resend settings reference under `refs/resend/settings` and add them to the shared UI component library.

The first implementation should support the visible patterns from the captured Usage and Billing settings screens while staying compatible with the current Korean messaging console.

## Source Reference

Reference files reviewed on 2026-06-03:

- `refs/resend/settings/resend.com/settings.html`
- `refs/resend/settings/resend.com/settings/billing.html`

Visible settings tabs in the reference:

- Usage
- Billing
- Team
- SMTP
- Integrations
- Unsubscribe page
- Documents

Visible reusable patterns:

- Horizontal settings tab navigation.
- Left-copy/right-list usage quota sections.
- Plan rows with limits, values, muted disabled states, and row actions.
- Billing section cards with a title, body, form content, and footer action.
- Compact empty states inside billing cards.
- Subscription product rows with quota, price, and action controls.
- Pay-as-you-go or add-on rows with a switch/checkbox and explanatory copy.

## Product Decisions

- Reuse the existing `SegmentedControl` for settings tabs instead of creating a new tab primitive.
- Add shared settings components to `src/components/ui`, not feature-local code.
- Keep the components data-driven and presentational. API reads, mutations, billing providers, and authorization logic remain outside this scope.
- Apply the new split-section and row components to the existing Settings usage and sender-resource surfaces so the extraction is exercised by app code.
- Add each newly exported settings component to the component playground with a visible `(setting)` tag.

## Components

### `SectionPanel`

Frame for Billing-like cards:

- Title and optional description.
- Body slot for forms, summaries, or empty states.
- Footer slot for actions such as Save or Add new card.

### `OverviewFormPanel`

Composite pattern for Team Overview-like cards:

- Uses `SectionPanel` as the frame.
- Avatar preview, update image action, remove image icon action, and file-size guidance.
- Avatar upload action exposes a loading state while upload is pending.
- Remove image action only appears when an avatar exists.
- Upload completion should be paired with the app toast system in consuming code.
- Team/name text field.
- Footer save action.
- Labels, value, help text, and save disabled state are configurable so the same pattern can be reused for organization/team overview settings.

### `SplitSection`

Usage-like two-column section:

- Left title, copy, and optional action.
- Right panel with optional table label/meta and row content.
- Disabled/muted state for unavailable product areas.

### `PropertyRow`

Reusable row for quota, resource, and setup lists:

- Leading icon slot.
- Label and optional detail.
- Value slot.
- Trailing action/status slot.

### `SubscriptionList`

Compact billing subscription list:

- Product label.
- Quota copy.
- Price/cadence.
- Optional row action and footer action.

### `InlineEmptyState`

Compact in-card empty state:

- Title/copy.
- Optional action.
- No large illustration, because billing cards in the reference are dense product-console surfaces.

### `PreferenceRow`

Pay-as-you-go/add-on row:

- Native checkbox.
- Title, optional price, and explanatory copy.
- Disabled state for unavailable paid-plan-only controls.

## Out Of Scope

- Real billing provider integration.
- Invoice downloads.
- Team member invitation flows.
- SMTP credentials.
- Integration setup flows.
- Dedicated documents or unsubscribe-page editors.
- A new top-level Settings page redesign.

## Playground Requirements

- Each new exported component has one playground page.
- Each new playground entry displays a `(setting)` tag.
- Playground variables should expose real component props such as labels, enabled/disabled state, and sample data density.

## Accessibility

- Components must use semantic sections, headings, rows, and native form controls where possible.
- Icon-only row actions must keep accessible labels through their child button components.
- Disabled settings areas must not rely on opacity alone when used for meaningful unavailable states; explanatory copy or disabled controls should remain present.
- Compact empty states must be readable without illustrations or color-only meaning.

## Verification

- Run `npm run lint`.
- Run `npm run build` to confirm dev-only playground code remains excluded from production.
- Start the dev server and inspect the settings component playground pages.
