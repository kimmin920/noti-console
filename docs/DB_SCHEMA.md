# Database Schema

The relay server schema lives in `src/db/schema.js` as JavaScript Drizzle table definitions. It defines local ownership, provider-neutral external auth account mappings, approval, settlement, evidence metadata, and audit records only.

Local users remain keyed by `users.id`. External login identities are stored in `external_auth_accounts` with `provider` values such as `clerk`, `publ`, `google`, and `kakao`, plus the provider subject identifier needed to map back to the local user. This table intentionally does not store OAuth access tokens, refresh tokens, provider secrets, or raw identity provider payloads.

The schema intentionally does not include local send-log, recipient-result, template-source-payload, recipient-phone-number, message-body, or template-parameter storage. NHN remains the source of truth for sent message logs, raw content, templates, recipient numbers, and final delivery results.

The only recipient-number exception is failed-recipient lookup metadata inside the existing provider request snapshot JSON: `messageSendProviderRequests.resultSnapshotJson.failedRecipientNos`. It is a sparse object keyed by one-based recipient sequence and stores failed recipient numbers only. Success, pending, and canceled recipient numbers are not stored there, and failed numbers are removed if a later authoritative result changes the same sequence to success or cancel. Do not add `recipientNo`, `phoneNumber`, `message_recipients`, `recipient_results`, or similar schema columns/tables for this exception.

Operational retention and audit behavior is documented in `docs/NHN_RELAY_OPERATIONS.md`.

## PUBL Event Catalog

PUBL event definitions are global catalog metadata stored in `publ_event_definitions` and `publ_event_prop_definitions`. They are intentionally not user-scoped and do not include sender-resource ownership or per-user access links.

These tables describe event keys and available property metadata only. They do not store event payloads, recipients, template bodies, template parameters, automatic sending rules, rendered output, or provider payloads.

The database is the source of truth for the PUBL event catalog. External JSON files may be used only as historical bootstrap/reference material and must not be re-synced in a way that deletes DB-created events. `category` is not part of the persisted PUBL event definition contract.

## PUBL Automation Metadata

PUBL channel mappings and automation rules are user-scoped operational metadata. Channel mappings connect a global `channelCode` to a local user through integration/token-exchange state; browser-managed automation rules do not store or ask operators to select a linked channel id. A user can have at most one enabled automation rule per PUBL event definition.

Automation rule rows store template references and safe browser-managed policy metadata only. Rule configuration JSON may include variable mappings by event-variable alias, recipient/target mapping policy, condition clauses over aliases, cooldown settings, validation result metadata, and the validated configuration hash/timestamps needed to enforce activation readiness. These rows must not persist message bodies, rendered Kakao content, raw recipient phone numbers, template parameter values, provider request bodies, provider response bodies, or raw event payloads.

Automation rule revisions store safe audit evidence for browser rule create, update, validate, enable, disable, and archive actions. Revision snapshots may include local ids, event keys, send channel, template codes/source labels, alias-based mappings, condition clauses, cooldown policy, validation reason codes, config hash, and status transitions. They must not store dry-run sample payload values, resolved recipient values, raw phone numbers, rendered content, template parameter values, provider grouping keys, provider payloads, or NHN secrets.

Automation event deliveries store idempotency, status, reason, masked target, and short-lived encrypted event data only after a known channel and matching rule make a user-facing delivery row appropriate. Rule-less events and unknown-channel events are intentionally not stored, and their payloads are not written to the database.

## Migration Workflow

Drizzle migrations are generated from `src/db/schema.js` through `drizzle.config.js` and committed under `drizzle/`.

Use these commands for schema changes:

```bash
npm run db:migration:generate -- --name=<descriptive_name>
npm run db:migration:verify
npm run db:migration:check
```

`db:migration:verify` is a local no-credentials check that scans generated SQL for forbidden local recipient/content/template/raw-provider storage. `db:migration:check` runs Drizzle Kit's migration-history consistency check and may require database credentials depending on the installed Drizzle Kit version.

Apply reviewed migrations with:

```bash
DATABASE_MIGRATION_URL=postgres://... npm run db:migration:apply
```

`DATABASE_MIGRATION_URL` should be a server-only production or staging migration URL, preferably for a role allowed to run reviewed DDL. If it is not set, the Drizzle config falls back to `DATABASE_URL`. Do not expose either value through `NEXT_PUBLIC_*`, browser code, client logs, or audit metadata.

Deployment workflow:

1. Generate migrations from the JavaScript schema.
2. Review the generated SQL for destructive DDL, enum changes, table rewrites, long locks, and the privacy boundary above.
3. Run `npm run db:migration:verify` and `npm run db:migration:check`.
4. Apply to staging with production-like data.
5. Back up or snapshot production.
6. Run `npm run db:migration:apply` once as a release or CI migration job before starting updated web and worker processes.

Do not use direct `drizzle-kit push` against production. Do not add ad hoc SQL migrations unless Drizzle cannot generate the required DDL and the migration file documents why the custom SQL is necessary.
