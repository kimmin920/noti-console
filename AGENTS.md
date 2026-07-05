# Messaging App Agent Guide

## Project Shape

This repository is a Next.js App Router messaging console scaffold.

- Runtime: Next.js 16, React 19, JavaScript ESM.
- Routes live under `src/app`.
- Console feature orchestration lives under `src/features/console`.
- Reusable UI primitives live under `src/components/ui`.
- Layout primitives live under `src/components/layout`.
- Development-only component playground lives under `src/playground` and `src/app/playground`.
- Database access starts at `src/db/client.js`; domain schemas are intentionally not defined yet.

## Commands

Run these before handing off meaningful code changes:

```bash
npm run lint
npm run build
```

Harness executor tests:

```bash
npm run harness:test
```

## Critical Rules

- Do not introduce TypeScript until the project intentionally migrates from JavaScript.
- Do not import `src/playground` from production routes or shared runtime modules.
- Keep `*.dev.jsx` playground routes development-only through `next.config.mjs`.
- Do not add domain schemas, migrations, external API calls, or auth routes without an explicit task.
- Outside the harness executor, do not commit, branch, or push unless the user explicitly asks for that operation.
- When `scripts/execute.py` is run, branch creation and two-stage commits are expected harness behavior.
- Keep changes scoped to the requested feature or harness step.

## UI Rules

- This is a product console, not a marketing site.
- Prefer dense, quiet, work-focused layouts.
- Use existing UI primitives before adding new ones.
- Buttons with icons should use `lucide-react` icons when available.
- Avoid decorative gradient orbs, glow effects, glassmorphism, and oversized card-heavy landing layouts.

## Frontend State Rules

- Use TanStack Query for server state once API-backed UI is introduced: reads, mutations, loading/error state, caching, refetching, and invalidation.
- Keep screen-local UI state in React. Prefer `useState` for simple state and `useReducer` with explicit action names for complex screen workflows.
- For complex workflows, prefer a command reducer pattern: actions update UI state and may describe commands; command runners execute async work such as TanStack Query mutations and dispatch success/failure actions.
- Keep reducers pure. Do not call APIs, route imperatively, mutate refs, or run TanStack Query mutations inside reducer functions.
- Do not mirror query data into reducer state. Derive view state from query results with selectors or `useMemo`.
- Avoid state-to-state synchronization effects such as deriving one React state value from another inside `useEffect`. Use explicit actions, selectors, or memoized derived values instead.
- Use `useEffect` only for synchronization with external systems such as subscriptions, browser APIs, timers, analytics, or imperative third-party widgets.
- Do not introduce Redux, Zustand, or another global state library without a concrete cross-route client-state problem.

## Harness Rules

- Large tasks should be split into `phases/{phase}/stepN.md` files and run with `scripts/execute.py`.
- Each step must be self-contained and list files the agent should read before editing.
- Acceptance Criteria must be executable commands, currently `npm run lint && npm run build`.
- The harness records `pending`, `completed`, `error`, and `blocked` states in JSON.
- The harness creates/checks out `feat-{phase}` by default.
- The harness makes separate code and metadata commits by default.
- Push is optional and only happens with `--push`.
