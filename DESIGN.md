# Messaging App Design System

## 1. Atmosphere & Identity

Messaging App is a quiet operational console for repeated messaging work. It should feel compact, predictable, and inspectable, with the strongest visual signature coming from restrained form surfaces, neutral text hierarchy, and small utility controls rather than decorative presentation.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| Surface/primary | `--bg` | `--background` (`#fdfdfd`) | `--background` (`#000000`) | App background |
| Surface/card | `--card` | `--color-white` (`#ffffff`) | `--gray-1` (`#141517`) | Panels and framed content |
| Surface/control | `--control` | `--gray-a2` | `--gray-a2` | Quiet control backgrounds |
| Surface/control hover | `--control-hover` | `--gray-a3` | `--gray-a3` | Hover state for controls |
| Text/primary | `--text` | `--gray-12` | `--gray-12` | Primary content |
| Text/secondary | `--text-soft` | `--gray-11` | `--gray-11` | Secondary content |
| Text/muted | `--muted` | `--gray-7` | `--gray-10` | Labels, captions, helper text |
| Text/placeholder | `--placeholder` | `--text-placeholder` | `--text-placeholder` | Input placeholders |
| Border/default | `--line` | `--gray-3` | `--gray-3` | Standard dividers and input borders |
| Border/subtle | `--line-soft` | `--gray-a3` | `--gray-a4` | Soft separators |
| Accent/primary | `--bg-accent` | `--color-black` | `--color-white` | Primary actions |
| Accent/hover | `--bg-accent-hover` | `--black-a11` | `--gray-12` | Primary action hover |
| Status/success | `--green` | `#1f7a3b` | `#1f7a3b` | Success states |
| Status/error | `--red` | `#b42318` | `#b42318` | Error states |
| Status/warning | `--yellow` | `#b7791f` | `#b7791f` | Warning states |
| Resend error/bg | `--red-a3` | `#f3000d14` | `#ff173f2d` | Source-backed invalid input fill for automation builder imports |
| Resend error/border | `--red-a6` / `--red-a7` | `#f8000442` / `#df000356` | `#ff3e5668` / `#ff536184` | Source-backed invalid input border and focus ring |

### Rules

- Use neutral surfaces and text tokens first; semantic colors are only for state.
- Avoid decorative gradients, glow, glassmorphism, and purple/indigo AI-style palettes.
- Do not add raw color values in component CSS unless a new semantic token is first added here.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
| --- | --- | --- | --- | --- | --- |
| Page title | 24px | 650-700 | 32px | 0 | Console page titles |
| Section title | 18px | 600 | 26px | 0 | Major panel headings |
| Body | 14px | 400 | 20px | 0 | Default app text |
| Label | 14px | 400 | 20px | 0 | Form labels and same-level panel labels |
| Caption | 12px | 400-500 | 16-17px | 0 | Helper text, limits, metadata |
| Micro | 11px | 500-600 | 14px | 0 | Dense badges and counters |

### Font Stack

- Primary: `var(--font-sans)`, currently Inter/system sans.
- Mono: `var(--font-mono)`, currently Commit Mono/system mono.

### Rules

- Console controls should favor the 14px body/label scale.
- Use 12px only for supporting metadata such as limits, descriptions, and counts.
- Letter spacing remains `0` unless a specific compact badge pattern documents otherwise.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px base.

| Token | Value | Usage |
| --- | --- | --- |
| `--space-1` | 4px | Tight inline gaps |
| `--space-2` | 8px | Compact row gaps |
| `--space-3` | 12px | Default form/panel gaps |
| `--space-4` | 16px | Standard panel padding |
| `--space-5` | 20px | Roomy local spacing |
| `--space-6` | 24px | Page section spacing |
| `--space-8` | 32px | Major group separation |
| `--spacing` | 4px | Resend automation compatibility unit used by source-backed CSS |
| `calc(var(--spacing) * 100)` | 400px | Captured automation trigger/send-email node width |
| `calc(var(--spacing) * 112)` | 448px | Captured automation action list width |

### Grid

- Primary shell sidebar width: `--sidebar` (`250px`).
- Console content should be dense and scannable with constrained panels, stable rows, and no marketing-style hero layout.

### Rules

- Prefer existing spacing values already present in `src/styles/components.css`.
- Keep fixed-format controls stable with explicit dimensions or min-width constraints.
- Avoid nested cards and decorative section wrappers.

## 5. Components

### Email Send Form Label

- **Structure**: `EmailSendFormLabel` renders a `label` or `span` with `.email-send-form-label` and inner `.email-send-form-label-text`.
- **Variants**: default, invalid via `.brand-message-local-validation-label.is-invalid`, required marker with `BrandMessageRequiredMark`.
- **Spacing**: inline icon-to-text gaps use 4px to 5px.
- **States**: invalid labels show red text and validation icon/tooltip.
- **Accessibility**: use `htmlFor` when labeling a concrete control; otherwise use span semantics for group headings.
- **Motion**: warning tooltip motion follows existing tooltip behavior.

### Product Console Panel Header

- **Structure**: `.brand-message-type-panel-header` contains a title area and optional action area.
- **Variants**: type title only, type title plus range metadata, title plus add action.
- **Spacing**: 12px header gap, compact 4px text-to-metadata gap.
- **States**: invalid titles reuse `EmailSendFormLabel` validation styling.
- **Accessibility**: action buttons use explicit `aria-label`; group headings do not pretend to be input labels.
- **Motion**: no decorative motion.

### Source-Backed Automation Builder Components

- **Structure**: `AutomationActionList`, `AutomationTriggerNode`, and `AutomationSendEmailNode` preserve the source `resend-ui-domain-*` class contract and data markers.
- **Variants**: action list selected state, trigger node connector/API action visibility, send-email picker/preview/settings/loading/empty/invalid states.
- **Spacing**: source-captured 400px node width, 448px action list width, 20px node padding, and 32px internal icon/control wells.
- **States**: hover, focus-visible, selected, disabled, loading, empty, draft notice, and invalid field states are retained from the source CSS.
- **Accessibility**: listbox/options, tabs, labeled inputs, icon-only button labels, and decorative connector semantics are part of the component contract.
- **Motion**: color/background/focus feedback uses the Resend compatibility `--ease-in-out` transition only.

### Onboarding Channel Selector

- **Structure**: `OnboardingChannelSelector` renders a radio-card group, `OnboardingChannelOptionCard` follows the resource-card body/action pattern with a native radio input, `OnboardingChannelRequirementList` remains available for detail surfaces, and `OnboardingChannelSummary` renders the selected-channel rationale.
- **Variants**: idle, selected, disabled option cards; optional summary and step action composition through `OnboardingStepActions`.
- **Spacing**: 12px option grid gap, 16px card body/action padding, 52px minimum action row, and 14px action row offset.
- **States**: hover, focus-visible through `:focus-within`, selected, active press, disabled, and polite summary updates.
- **Accessibility**: native radio inputs retain keyboard and screen-reader behavior inside a labeled radiogroup; the selected summary uses polite live updates.
- **Motion**: selection and hover feedback are limited to color, border, and a 1px active `transform`.

### PUBL Event Variable Table

- **Structure**: `PublEventVariablesSection` uses `DataTableV2` with a compact fixed-layout variable table and a right-sticky action column.
- **Spacing**: desktop table minimum width is 960px; label and alias columns keep readable minimums while usage, parser, and action columns stay fixed.
- **States**: row hover, focus, focus-within, and selected states use an opaque `--pe-row-hover` surface so sticky action cells visually remain part of the active row.
- **Interaction**: `변수 추가` opens a drawer-local draft; the table row is created only after the drawer `추가` action, so closing or canceling the drawer never leaves a ghost variable row.
- **Accessibility**: rows keep button semantics and the action trigger remains isolated from row click propagation.
- **Motion**: feedback remains limited to background and color transitions.

### PUBL Event Catalog Table

- **Structure**: `PublEventsDataTable` uses the standard `DataTableV2` table chrome with event identity, location ID, used-variable chips, automation connection state, and a compact detail action.
- **Spacing**: rows keep the existing `resend-email-table` header, horizontal scroll, and compact row rhythm; used-variable chips use 4px gaps, wrap to two lines by default, and render `더보기` as the final visible chip when the list overflows.
- **Color**: used-variable chips stay on `--control`; the `더보기` chip uses the slightly stronger `--control-hover` neutral surface so the expansion affordance is visible without becoming an accent badge.
- **States**: automation state uses semantic chips for enabled, connected, none, loading, and unknown states while variables remain neutral control chips.
- **Accessibility**: variable cells expose the full used-variable list through `aria-label` and `title`; required variables are marked with `*` inside the chip, not as a separate table column.
- **Motion**: feedback remains limited to existing table row hover and color changes.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
| --- | --- | --- | --- |
| Micro | 120-160ms | ease | Button hover, color shifts |
| Standard | 180-240ms | ease-in-out | Disclosures and local panel changes |
| Dialog overlay | `--modal-open-dur` 200ms / `--modal-close-dur` 150ms | `--modal-ease` | Modal open and close transitions |

### Rules

- Animate only `transform`, `opacity`, or color/background changes.
- Every interactive control needs hover, active, focus, disabled, and invalid states where applicable.
- Respect reduced motion for nonessential transitions.
- Dialog motion uses `--modal-scale`, `--modal-scale-close`, and `--modal-y` with `data-state` so close transitions complete before unmount.

## 7. Depth & Surface

### Strategy

Use borders-only with tonal shifts.

| Type | Value | Usage |
| --- | --- | --- |
| Default border | `1px solid var(--line)` | Inputs and framed controls |
| Subtle border | `1px solid var(--email-send-form-black-2)` or `var(--line-soft)` | Panel separators |
| Control surface | `var(--control)` | Quiet selected/active states |

### Rules

- Shadows are reserved for overlays, popovers, dialogs, and toasts.
- Form panels should separate hierarchy through spacing, borders, and typography, not decorative depth.
