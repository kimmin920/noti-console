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
- Subsequent `/publ-client?page=...` loads mount and authorize the SDK so tap and
  refresh capabilities are restored, but reuse a complete stored token pair and
  do not exchange another token.
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

## Send and history parity

- A selected `publ-contact` is expanded to the existing provider payload using
  only its concrete `recipientNo`.
- Publ sends use the existing message-send ledger, grouping keys, provider log
  lookup, and result snapshot behavior.
- Do not add `recipientSnapshotJson` or a database migration in this phase.
- Existing history behavior remains: one recipient may show a representative
  number, multiple recipients show a count, and the detail result table lists
  stored failures.

## Verification

```bash
npm run test:publ-iframe-recipient-contract
npm run test:server
npm run harness:test
npm run lint && npm run build
```
