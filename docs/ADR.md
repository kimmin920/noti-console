# Architecture Decision Records

## Philosophy

Prefer a working, inspectable scaffold over premature infrastructure. Add stronger abstractions only when a real feature creates repeated behavior or a cross-module contract.

## ADR-001: Next.js App Router

**Decision**: Use Next.js App Router for route organization and deployment shape.

**Reason**: The app needs a web console, server-capable routes, and a straightforward path to self-hosting.

**Tradeoff**: Route conventions are framework-specific, so shared business logic should remain outside route files.

## ADR-002: JavaScript ESM First

**Decision**: Keep the project in JavaScript ESM for now.

**Reason**: The scaffold is early and does not yet have enough domain model surface to justify a TypeScript migration.

**Tradeoff**: Runtime validation and careful linting matter more until typed schemas are introduced.

## ADR-003: Component Playground Is Development-Only

**Decision**: Keep the UI playground available only in development through `*.dev.jsx` page extensions.

**Reason**: The playground helps component extraction without adding production routes.

**Tradeoff**: Component previews must be checked in dev separately from production build output.

## ADR-004: Codex Full Harness

**Decision**: Use a Codex-native full harness for phased work.

**Reason**: Large work such as auth, schemas, message delivery, and integration flows benefits from self-contained step files, repeatable acceptance criteria, status tracking, retries, and separated commits.

**Tradeoff**: Small changes should still be done directly. Harness runs create branches and commits by default, so the working tree should be reviewed before running a phase.

## ADR-005: Frontend State Boundaries

**Decision**: Use TanStack Query for server state and React local state for screen state. Complex screen workflows should use explicit reducer actions, and may use a command reducer pattern when an action should also trigger async work.

**Reason**: The console has API-backed workflows such as sending messages, checking logs, managing templates, and approval flows. TanStack Query gives those workflows a single owner for server reads, mutations, loading/error state, caching, refetching, and invalidation. Reducer actions keep local UI transitions inspectable without introducing a global state library.

**Tradeoff**: The command reducer pattern is project code, not a React built-in. It should be reserved for workflows where explicit action logs and centralized transitions are worth the extra structure. Simple pages should use direct React state plus TanStack Query.
