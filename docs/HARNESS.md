# Codex Full Harness

The harness is a Codex-native port of the original Claude harness workflow.
It runs large tasks as isolated steps, carries context forward through summaries,
records status in JSON, retries failed steps, and commits code separately from
harness metadata.

## Files

- `AGENTS.md`: project rules that Codex can read during normal work.
- `docs/*.md`: guardrails injected into each harness step.
- `docs/FRONTEND_HARNESS.md`: extra guidance for frontend API integration phases.
- `docs/SOURCE_REFERENCE_HARNESS.md`: required guidance when porting behavior
  from a source app, compiled bundle, screenshot-backed reference, or sibling
  repository.
- `phases/index.json`: top-level phase registry.
- `phases/{phase}/index.json`: step status for one phase.
- `phases/{phase}/stepN.md`: self-contained step instructions.
- `scripts/execute.py`: Codex step executor.
- `scripts/test_execute.py`: executor safety tests.

## Phase Index

```json
{
  "phases": [
    {
      "dir": "0-example",
      "status": "pending"
    }
  ]
}
```

## Step Index

```json
{
  "project": "messaging-app",
  "phase": "0-example",
  "steps": [
    { "step": 0, "name": "first-step", "status": "pending" }
  ]
}
```

Valid step states:

- `pending`
- `completed`
- `error`
- `blocked`

Status fields written by the executor:

| Transition | Fields |
| --- | --- |
| start phase | `created_at` |
| start step | `started_at` |
| completed | `completed_at` |
| error | `failed_at`, `error_message` |
| blocked | `blocked_at`, `blocked_reason` |

## Step File Shape

```markdown
# Step 0: first-step

## Read First

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`

## Task

Describe the exact implementation scope.

## Acceptance Criteria

```bash
npm run lint
npm run build
```

## Do Not

- Do not work outside this step's scope.
```

## Frontend Phases

Frontend API integration phases should follow `docs/FRONTEND_HARNESS.md`.
That guide is automatically injected with the rest of `docs/*.md`, but frontend
step files should still list it under `Read First` so the step scope is explicit.

Frontend steps should keep server state in TanStack Query, UI workflow state in
React reducer actions where useful, and avoid `useEffect` state-to-state
synchronization.

Frontend UI style references must be implemented from the existing source code,
not from screenshot interpretation. Do not use the `frontend-design` skill for
this project. When the user points to an existing in-app style, first read the
source component and CSS that render that style, then reuse its structure,
classes, and CSS patterns directly.

When a phase ports behavior from an external or sibling source reference, follow
`docs/SOURCE_REFERENCE_HARNESS.md`. Step files should list it under `Read First`
and must capture the source control inventory, source-reachable state
combinations, container-to-renderer prop mapping, user-event state transitions,
validation UI paths, and negative assertions for mutually exclusive render
states.

Source-required local controls are not optional. A phase cannot be completed
with renderer-only or pure-validation tests if a source mode still lacks a local
control that the source renders, such as an upload input, checklist, toggle, or
template-type gated form section. Those controls need DOM/browser proof unless
the step gives a precise provider/API/persistence out-of-scope reason.

Harness steps must permanently avoid the `frontend-design` skill. Product copy
and user-facing labels must avoid third-party provider brand names; use neutral
terms such as `provider`, `external provider`, or channel labels instead.

## Database Migration Gate

The executor runs an automatic migration gate after any completed step that
changes `src/db/schema.js`, `drizzle.config.js`, or files under `drizzle/`.

The gate loads environment values from `.env`, then `.env.local`, then the
current process environment, and runs:

```bash
npm run db:migration:verify
npm run db:migration:check
npm run db:migration:apply
```

If `DATABASE_MIGRATION_URL` or `DATABASE_URL` is not available, or any command
fails, the step is not accepted as completed. The executor retries the step with
the concrete migration failure in the prompt. This keeps server/schema work from
passing while the local database is still missing newly generated tables,
columns, indexes, or enum values.

When writing a schema step, still include migration commands in that step's own
Acceptance Criteria so the agent can fix failures before the post-step gate.

## Commands

Run a phase:

```bash
npm run harness:run -- 0-example
```

Equivalent direct command:

```bash
python3 scripts/execute.py 0-example
```

Run executor tests:

```bash
npm run harness:test
```

Review current changes:

```bash
npm run harness:review
```

Default executor behavior:

- Create or checkout `feat-{phase}`.
- Inject `AGENTS.md` and `docs/*.md` into each Codex step prompt.
- Include completed step summaries in later step prompts.
- Retry a step up to three times if it does not mark itself `completed` or `blocked`.
- Write `stepN-output.json` and `stepN-output.md`.
- Commit code changes as `feat({phase}): step N - {name}`.
- Commit harness metadata as `chore({phase}): step N output`.

Push is opt-in:

```bash
python3 scripts/execute.py 0-example --push
```

Safety/debug flags:

```bash
python3 scripts/execute.py 0-example --no-branch
python3 scripts/execute.py 0-example --no-commit
python3 scripts/execute.py 0-example --dangerous
```

`--dangerous` maps to Codex CLI's sandbox/approval bypass. Use it only for
trusted local automation where the environment is already isolated.
