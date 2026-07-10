# Publ iframe recipient integration contract

## Entry and authentication matrix

| Entry | Authentication | Recipient source |
| --- | --- | --- |
| Standalone console | Clerk | Local/manual recipient paths |
| Publ iframe `/publ-client` | Publ SDK exchange and local bearer token | Publ SDK member contacts |
| Top-level `/publ-client` | No Publ exchange; redirect to `/message-send` | Standalone console |

The iframe check must run before SDK loading, mounting, authorization, or token
exchange. Server token endpoints remain protected by Publ API key and signed JWT
verification.

## Session lifecycle

- The first valid iframe entry mounts and authorizes the SDK, exchanges tokens,
  and stores access and refresh tokens in `sessionStorage`.
- Same-document pathname navigation such as `/publ-client/logs`,
  `/publ-client/reservations/reservation-1`, and
  `/publ-client/templates/sms/TPL-1` stays inside the persistent Publ session
  boundary and reuses the in-memory runtime without another exchange.
- The pathname determines route identity. Query parameters are reserved for
  filters, pagination, tabs, and route-specific context, for example
  `/publ-client/logs?channel=sms&page=2`; a `page` query parameter never selects
  a console route.
- A fresh JavaScript document never treats existing `sessionStorage` tokens as a
  resumable session. It clears stale local tokens, mounts and authorizes the SDK,
  and exchanges again so runtime identity and cache ownership are fresh.
- A local API `401` refreshes once through the SDK. Refresh failure clears both
  tokens and returns the iframe to its reconnect state.

## Recipient ownership

- Publ member contacts are read through the SDK catalog tap and normalized into
  concrete `publ-contact` options.
- A Publ contact is sendable only when one of the granted phone resources
  contains a plausible phone number.
- Publ contacts and future Publ segments are not copied into local audience
  tables.
- The internal option keeps a source discriminator so future local recipients
  can coexist without changing the send form contract.
- Standalone recipient behavior remains unchanged.

## User interface

- Publ embed message forms show `Publ recipients` and `Publ segments` as a
  recipient-source tab set independent from SMS, AlimTalk, and Brand Message
  channel tabs.
- All three channel forms receive the same normalized Publ contact options.
- The Publ audience page shows only Publ recipient/segment tabs. It must not
  render the standalone mock audience table in embed mode.
- Missing segment capability renders an explicit empty state and does not fall
  back to standalone segments.
- If the member-contacts permission is missing or the SDK denies it, the
  recipient source state is `permission-denied`. The UI renders the permission
  error and still allows direct manual recipient entry where the channel form
  supports it. The app must not fabricate contacts or segments from standalone
  mock data.

## Send and history parity

- A selected `publ-contact` is expanded to the existing provider payload using
  only its concrete `recipientNo`.
- Publ sends use the existing message-send ledger, grouping keys, provider log
  lookup, and result snapshot behavior.
- Do not add `recipientSnapshotJson` or a database migration in this phase.
- Existing history behavior remains: one recipient may show a representative
  number, multiple recipients show a count, and the detail result table lists
  stored failures.
- CSV export remains deferred to the standalone console in this phase. Embed
  mode hides download actions and shows the CSV-unavailable copy instead of
  attempting a Publ-authenticated CSV download.

## Verification

```bash
npm run test:publ-iframe-recipient-contract
npm run test:publ-client-e2e
npm run test:server
npm run harness:test
npm run lint && npm run build
```
