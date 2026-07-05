# UI Playground Harness

The playground is a development-only component harness at `/playground`.

Rules:

1. Production builds must not import the playground or its registry.
2. Every extracted component must be exported from its component module.
3. Every extracted component must be imported into `src/playground/componentRegistry.jsx`.
4. Every extracted component must have exactly one component page in the playground.
5. Every component page must expose relevant variables in the variables panel.
6. Do not add invented UI solely for state checking or status verification; playground pages may only expose real component behavior and explicit variables.
7. After componentization, verify the component page in dev and run `npm run build` to confirm the playground is excluded.

Current entrypoint:

- Dev: `next.config.mjs` includes the `dev.jsx` page extension, so `src/app/playground/[[...slug]]/page.dev.jsx` mounts `src/playground/Playground.jsx`.
- Production: `next.config.mjs` excludes `dev.jsx`, so the playground route is not part of the production route graph.

Route format:

- `/playground/:section/:component`
- Example: `/playground/ui/button`

## Domain Detail Source Contract

The Resend domain detail reproduction has a source-contract harness:

```bash
npm run test:domain-detail-contract
```

The harness reads the captured source HTML from:

```text
../resends-clone/refs/resend/domain-detail/resend.com/domains/f6a0e4ae-8a5c-46e7-9507-a83fb3295ee4.html
```

It fails when source-matched details drift, including:

- Records / Configuration tablist spacing and selected state.
- The records panel frame, padding, and left accent bar (`absolute left-0 top-[22px] h-8 w-1 rounded-br-md rounded-tr-md bg-gray-3`).
- DNS Records header actions.
- Enable Sending divider and checked switch.
- DNS table spacing and breakpoint column widths.

Use `DOMAIN_DETAIL_REF_HTML=/absolute/path/to/source.html npm run test:domain-detail-contract` when the captured reference moves.
