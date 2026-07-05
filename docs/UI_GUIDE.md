# UI Guide

## Principles

1. Build a console for repeated work, not a landing page.
2. Keep hierarchy compact and scannable.
3. Prefer predictable controls over decorative surfaces.
4. Reuse existing primitives before creating a new component.

## Visual Direction

- Light, restrained interface.
- Neutral backgrounds and text with limited semantic color.
- Tight page headers, stable toolbars, and table/empty-state patterns.
- Cards only for genuinely framed content such as profile/settings panels or repeated items.

## Avoid

| Pattern | Reason |
| --- | --- |
| Gradient orbs and glow effects | Decorative noise that does not help console work |
| Glassmorphism | Weak readability and generic SaaS styling |
| Oversized hero sections | The product is an app surface, not a marketing page |
| Purple/indigo AI-style palette | Off-brand for this quiet operational console |
| Nested cards | Adds visual clutter and weakens hierarchy |

## Components

- Use `Button` for clear commands.
- Use `IconButton` for compact icon-only actions with accessible labels.
- Use `Toast` for non-blocking success/error feedback after user-triggered actions.
- Use `Dialog` for focused modal tasks with explicit title, close, focus trap, and return focus.
- Use `ConfirmationDialog` for destructive or high-impact actions with specific labels and consequences.
- Use `Accordion` for grouped navigation sections and docs-style disclosure lists.
- Use `ActionMenu` for row actions and compact command lists that need keyboard menu behavior.
- Use `Popover` for lightweight contextual help that follows its trigger in the DOM and has an explicit close path.
- Use `CommandPalette` for global quick navigation and frequent console commands.
- Use `Checkbox` for row selection and multi-select controls.
- Use `BulkActionBar` for selected table rows and scoped bulk actions.
- Use `Tooltip` for Resend-style hover/focus labels. It renders through a Base UI portal, supports collision-aware side flipping, and also exports `TooltipRoot`, `TooltipTrigger`, `TooltipContent`, and `TooltipProvider` for compound composition.
- Use `Kbd` for compact keyboard hints.
- Use `TextField` for composable text inputs with slots.
- Use `SearchField` for toolbar search.
- Use `EmailSendForm` for the Resend-origin editor selection surface; keep its Reply-To, schedule, preview text, recipient autocomplete, topic, and template import controls state-linked.
- Use `CopyButton` and `CopyableSlot` for read-only IDs, keys, and endpoints.
- Use `CodeBlock` for copyable API snippets.
- Use `CodeGroup` for Resend-origin docs snippets with language tabs.
- Use `DocsCallout` for Resend/Mintlify-origin Info, Note, Tip, and Warning blocks.
- Use `DocsCard` and `DocsCardGrid` for linked docs resource collections.
- Use `Drawer` for focused side-sheet tasks such as API examples and previews.
- Use `DropdownMenu` for anchored action and filter menus that need keyboard-accessible items.
- Use `FilterSelect` for toolbar filters with single or multiple selection.
- Use `DatePickerPresets` for date-range filters that need presets plus custom range apply/cancel.
- Use `SegmentedControl` for mode switching.
- Use `SelectPill` for toolbar filters.
- Use `DataTable` for structured row data.
- Use `Pagination` below data tables with bounded page and page-size controls.
- Use `EmptyState` for pages without records.

## Playground

Every extracted UI component should have exactly one page in the development playground and expose meaningful controls in the variables panel.
