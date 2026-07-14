# RUI Migration Matrix

## Boundaries

- `src/ui-kits/resend/**` is generated from the Resend UI source and is never edited manually.
- Application and playground code remain JavaScript.
- Production routes import RUI from `@/ui-kits/resend`.
- Generated RUI is excluded from target ESLint and is validated by source QA plus copy hashes.
- Workspace TypeScript validation is disabled because every TS/TSX file belongs to the generated
  RUI boundary; application JavaScript validation remains enabled.
- Legacy components and CSS are removed only after their import and selector counts reach zero.
- Components without a ready RUI equivalent remain legacy until the source kit publishes one.

## Migration Order

| Phase | Ready RUI families | Legacy targets | State |
| --- | --- | --- | --- |
| 0 | foundation, tokens, fonts | root theme and CSS wiring | Complete |
| 1 | button, icon-button | `Button`, `IconButton`, shared button actions | Complete |
| 2 | input, textarea, checkbox, radio-group, switch | matching shared form controls | Complete |
| 3 | select-trigger, select, multi-select, search-field, filter-button | `FilterSelect`, `SearchField`, `SelectPill` | Complete |
| 4 | form-field, typography | `FormField`, labels, help/error text | Complete |
| 5 | tabs, dropdown-menu, drawer | matching legacy overlays and navigation controls | Complete |
| 6 | card, status-label, empty-state | `Card`, `Panel`, `Badge`, `EmptyState` | Complete |
| 7 | toast | `ToastProvider`, `useToast` | Complete |
| 8 | data-table | `DataTableV2` rendering primitives | Complete |
| 9 | page-header-actions, api-drawer | page headers and toolbar API drawer | Complete |

## Ready Families Without A Direct Legacy Name

- `radio-group`
- `switch`
- `multi-select`
- `select-trigger`
- `filter-button`
- `typography`
- `status-label`
- `page-header-actions`
- `api-drawer`

These are adopted where their semantics match existing raw or composed UI. They do not justify
changing product behavior solely to increase kit usage.

## Legacy Components Blocked By RUI Coverage

- Accordion
- Chart
- CommandPalette
- ConfirmationDialog
- DatePickerPresets
- Dialog
- FileUploadField
- ImageCropDialog
- Pagination
- Popover
- Tooltip

Feature-specific message editors, previews, and domain compositions stay outside the primitive kit.
Their internal ready primitives are migrated independently.

Raw controls remain when they implement a semantic component that ready RUI does not supply, such
as calendar days, pagination, image crop controls, message preview interactions, and builder canvas
controls. They are not treated as generic replacements for a ready RUI button or input.

## Variant Decisions

- Legacy `primary` buttons map to RUI `accent`.
- Legacy `secondary` and default buttons map to RUI `interactive`.
- Legacy `danger` has no ready RUI variant. Destructive actions stay on the legacy button until the
  source kit publishes a semantic destructive variant; they are not silently restyled.

## Verification Gate Per Phase

1. Search for remaining legacy imports and raw equivalent controls.
2. Run focused tests for touched features.
3. Run `npm run lint` and `npm run build`.
4. Exercise affected routes, overlays, keyboard interactions, and responsive states.
5. Run the source copy tool with `--check` to prove generated files were not modified.

## Completed Evidence

- Source revision: `7ba46ec14336726c3db3dcf083ed0a31f6e5c0b2`
- Generated ready families: 24
- Previous `src/resend-ui` copy: removed
- Previous shared implementation files removed: Button, IconButton, Card, Checkbox, DataTableV2,
  Drawer, DropdownMenu, EmptyState, FilterSelect, FormField, Panel, SearchField, SegmentedControl,
  SelectPill, TextField, and Toast
- Exact legacy `.button` and `.icon-button` CSS consumers: zero
- Development catalog: every ready family returns HTTP 200, renders a visible preview, and produces
  no console or page errors
- Production route manifest: 62 pages, with no playground route
