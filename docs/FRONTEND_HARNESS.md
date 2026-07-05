# Frontend Harness Guide

Use this guide when creating or executing harness phases for frontend API integration.

## Purpose

Frontend harness steps should make UI/API integration repeatable without drifting into ad hoc state management. Each step must keep server state, UI workflow state, and test behavior in clear ownership boundaries.

## Style Reference Contract

- Do not use the `frontend-design` skill for this project.
- When a user references an existing in-app style, screenshot, or component, first locate and read the source component and CSS that produce that style.
- Implement the requested UI by reusing the actual component structure, class names, and CSS patterns from that source. Do not infer a new style from the screenshot alone.
- Keep style changes scoped to matching the referenced in-app implementation unless the step explicitly asks for a new design system pattern.
- When the reference is an external source app, compiled bundle, or sibling repo, also follow `docs/SOURCE_REFERENCE_HARNESS.md`. The harness must prove the source control inventory, source-reachable state, container-to-renderer prop mapping, user-event state transitions, validation UI paths, and negative assertions for mutually exclusive render states.
- Required source controls must be asserted through the rendered UI, not only by reading component source. If a template type, tab, or toggle in the source exposes a local file input, upload widget, checklist, select, or submit-blocking validation surface, the step needs DOM/browser evidence for that control unless it is precisely out of scope because it requires provider/API/persistence behavior.

## Required Read First

Frontend API steps should include these files in `Read First`:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/UI_GUIDE.md`
- `docs/FRONTEND_HARNESS.md`
- `docs/SOURCE_REFERENCE_HARNESS.md` when porting source-reference behavior
- `docs/NHN_RELAY_FRONTEND_API.md` when using relay APIs
- The relevant route handlers under `src/app/api`
- The relevant server services under `src/server`
- The relevant UI primitives under `src/components/ui`
- The relevant console files under `src/features/console`
- Previous phase or step output summaries when available

## State Contract

- Use TanStack Query for server state:
  - API reads
  - mutations
  - loading and error state
  - cache invalidation
  - refetching and polling
- Use React state for screen-local UI state:
  - `useState` for simple state
  - `useReducer` with explicit action names for complex workflows
- Use a command reducer pattern only when it makes the workflow easier to inspect:

```text
user event -> action -> pure reducer -> next UI state + optional command
command runner -> async work/mutation -> success or failure action
```

- Reducers must stay pure. Do not run TanStack Query mutations, call APIs, navigate, mutate refs, or touch browser-only systems inside reducers.
- Do not copy query data into reducer state. Use query results directly and derive view state through selectors or `useMemo`.
- Do not use `useEffect` to derive one React state value from another. Use explicit actions, selectors, or memoized derived values.
- Use `useEffect` only for external system synchronization, such as subscriptions, browser APIs, timers, analytics, or imperative widgets.
- Do not add Redux, Zustand, or another global state library unless the step proves a concrete cross-route client-state problem.

## File Shape

Prefer feature-local modules when a screen becomes API-backed:

```text
src/features/console/{feature}/
  apiClient.js       HTTP wrapper calls to our Next.js API routes
  queryKeys.js       TanStack Query keys
  queries.js         useQuery/useMutation hooks
  reducer.js         local UI workflow reducer
  actions.js         action creators, when useful
  selectors.js       derived view state
```

Keep this structure proportional. Do not split tiny pages into every file unless the workflow needs it.

## Step Design

Good frontend harness steps are narrow and independently verifiable. A typical API-backed phase can be split like this:

1. Data foundation:
   - Add TanStack Query provider and shared API client helpers.
   - Add query-key conventions and error normalization.
2. Read screen:
   - Connect one list/detail page to API reads.
   - Preserve loading, error, empty, and pagination states.
3. Workflow screen:
   - Connect mutations through command reducer actions when the workflow is complex.
   - Invalidate related queries after successful mutations.
4. Test and harden:
   - Add focused E2E smoke tests if Playwright is introduced.
   - Verify validation, unauthorized, empty, and provider-error surfaces.

## Step Acceptance

Every meaningful frontend code step must include:

```bash
npm run lint && npm run build
```

Add `npm run harness:test` only when modifying harness executor behavior. Add an E2E command only after Playwright or another E2E runner is introduced and scripted in `package.json`.

## Review Checklist

Before marking a frontend step complete, verify:

- Query data is not mirrored into reducer state.
- Reducers are pure and deterministic.
- Complex workflows have inspectable action names.
- Mutations invalidate the queries whose server data may have changed.
- URL-search state is used for navigable filters, page numbers, and shareable view state.
- Loading, error, empty, and success states are visible and accessible.
- Existing UI primitives are reused before new components are added.
- No production route imports from `src/playground`.
- Source-reference phases include DOM/browser evidence for every required source control, not only for preview renderer branches.
