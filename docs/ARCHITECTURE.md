# Architecture

## Directory Structure

```text
src/
  app/                 Route entrypoints and global providers
    (console)/         Standalone console routes and console-only layout
  components/
    docs/              Documentation page primitives
    layout/            Console layout primitives
    ui/                Reusable UI controls
  db/                  Database client setup
  features/
    console/           Console routing, metadata, shells, and domain screens
    publClient/        Publ iframe bootstrap and embedded console entry
  nav-lotties/         Sidebar animation assets
  playground/          Development-only component harness
  styles/              Shared CSS
scripts/               Local worker and harness tooling
docs/                  Product, architecture, ADR, UI, and harness docs
phases/                Harness phase indexes and step files
```

## Runtime Pattern

- Standalone console routes live in `src/app/(console)` and import their feature screen directly.
- `StandaloneConsoleRoute` supplies shared page metadata, document navigation, and console runtime effects without selecting the screen.
- The Publ iframe entry uses `ConsoleScreenOutlet` to select the same feature screens by page id. Do not create embed-only copies of console screens.
- Client components must be marked with `'use client'` only when they need client state, effects, routing, or browser APIs.
- Shared UI should be extracted into `src/components/ui` or `src/components/layout` before being duplicated across pages.
- Production builds must not include the playground route; `next.config.mjs` controls `*.dev.jsx` page inclusion.

## Data Flow

Standalone console pages:

```text
app/(console) route -> StandaloneConsoleRoute -> domain screen -> UI primitives
                         |
                         +-> ConsoleRootFrame -> app/embed shell
```

Publ iframe pages reuse those domain screens:

```text
/publ-client -> PublClientBootstrap -> MessagingConsole
             -> ConsoleScreenOutlet -> domain screen -> UI primitives
```

Future server-backed features should keep external API and database access on the server side.

## State Management

- Server state belongs to TanStack Query once API-backed UI is introduced. Use it for reads, mutations, loading/error state, caching, refetching, and invalidation.
- Screen-local UI state belongs to React. Use `useState` for simple state and `useReducer` with explicit action names for complex screen workflows.
- For complex workflows, prefer a command reducer pattern:

```text
user event -> action -> pure reducer -> next UI state + optional command
command runner -> async work/mutation -> success or failure action
```

- Reducers must stay pure. They may validate state and describe commands, but they must not call APIs, run mutations, navigate, mutate refs, or touch browser-only systems.
- Do not mirror query data into reducer state. Read query results directly and derive view state with selectors or `useMemo`.
- Avoid state-to-state synchronization effects, for example deriving one React state value from another inside `useEffect`. Prefer explicit actions for user intent and selectors for derived values.
- Reserve `useEffect` for synchronization with external systems such as subscriptions, browser APIs, timers, analytics, or imperative third-party widgets.
- Do not introduce Redux, Zustand, or another global state library without a concrete cross-route client-state problem.

Recommended boundaries:

```text
Server data           -> TanStack Query
Server-changing work  -> TanStack Query mutations
UI workflow state     -> React reducer actions
Derived view state    -> selectors/useMemo
Navigable state       -> URL search params
Authentication        -> Clerk
```

## Verification

The current baseline for implementation work is:

```bash
npm run lint
npm run build
```
