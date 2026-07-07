# Publ PApp Integration

This document describes the Publ 3rd party PApp SSO integration for VIZUO noti.
Keep all Publ-issued keys and local token secrets server-only. Do not place them
in `NEXT_PUBLIC_*`, route responses, client logs, analytics, or committed files.

## Publ-Facing Values

Publ receives these values for each environment:

| Environment | pApp code | OUTGOING_HOST | CLIENT_SRC | GRANTED_CLIENT_HOSTS | WEBHOOK_ENDPOINT_SRC |
| --- | --- | --- | --- | --- | --- |
| dev/test | `3RD_A00003_TEST` | `https://noti-dev.vizuo.work` | `https://noti-dev.vizuo.work/publ-client` | `noti-dev.vizuo.work`, `localhost:3000`, `127.0.0.1:3000` | `https://noti-dev.vizuo.work/api/open/v1/publ/events` |
| prod/release | `3RD_A00003` | `https://noti.vizuo.work` | `https://noti.vizuo.work/publ-client` | `noti.vizuo.work` | `https://noti.vizuo.work/api/open/v1/publ/events` |

`WEBHOOK_ENDPOINT_SRC` is the existing Publ automation-event receiver. It is
separate from PApp token exchange.

## Server Variables

Configure these only in server environments such as Dokploy `.env`:

```bash
PUBL_OPEN_API_WEBHOOK_SECRET=

PUBL_PAPP_TEST_CODE=3RD_A00003_TEST
PUBL_PAPP_TEST_OUTGOING_API_KEY=
PUBL_PAPP_TEST_OUTGOING_SECRET_KEY=
PUBL_PAPP_RELEASE_CODE=3RD_A00003
PUBL_PAPP_RELEASE_OUTGOING_API_KEY=
PUBL_PAPP_RELEASE_OUTGOING_SECRET_KEY=
PUBL_PAPP_ACCESS_TOKEN_SECRET=
PUBL_PAPP_REFRESH_TOKEN_HASH_SECRET=
```

The pApp code values have safe defaults in server code. The outgoing API keys,
outgoing secret keys, access-token signing secret, refresh-token hash secret, and
webhook secret do not default. `incoming_api_key` and `incoming_secret_key` are
reserved for future Server-to-Publ-Server calls and are intentionally unused in
this phase.

## iframe Client Variables

These values are read server-side and serialized only into `/publ-client`. They
are client-visible, so do not place Publ secret keys here.

```bash
PUBL_PAPP_CLIENT_STAGE=test
PUBL_PAPP_SDK_SRC=/vendor/publ-p-app-client-sdk.testflight.js
PUBL_PAPP_TEST_CLIENT_HASH=
PUBL_PAPP_RELEASE_CLIENT_HASH=
PUBL_PAPP_TEST_SELLER_INFO_PERMISSION_ID=
PUBL_PAPP_TEST_MEMBER_CONTACTS_PERMISSION_ID=
PUBL_PAPP_RELEASE_SELLER_INFO_PERMISSION_ID=
PUBL_PAPP_RELEASE_MEMBER_CONTACTS_PERMISSION_ID=
```

`PUBL_PAPP_CLIENT_STAGE` defaults to `release` only when `APP_ENV=production`;
otherwise it defaults to `test`. `PUBL_PAPP_SDK_SRC` defaults to the bundled
testflight SDK only in the test stage. Release must set the Publ-hosted or
release-approved SDK URL explicitly.

Exchange and refresh permission IDs default to Publ's fixed values:
`PM_00000_EXCHANGE_TOKEN` and `PM_00000_REFRESH_TOKEN`. Seller-info and member
contacts permission IDs are optional until Publ grants them for the same stage.

## Token Exchange

The iframe client does not call these routes by hand. It calls Publ SDK
`pipeline.request(...)`; Publ's pipeline proxy then calls VIZUO directly. These
routes intentionally do not use the relay `{ ok, data, error }` envelope.

Exchange:

```http
POST /integrations/exchange-token?apiKey={outgoing_api_key}
Authorization: Bearer {publ_jwt}
Content-Type: application/json

{}
```

Success:

```json
{
  "data": {
    "accessToken": "THIRD_PARTY_ACCESS_TOKEN",
    "refreshToken": "THIRD_PARTY_REFRESH_TOKEN"
  }
}
```

Refresh:

```http
POST /integrations/refresh-token?apiKey={outgoing_api_key}
Authorization: Bearer {publ_jwt}
Content-Type: application/json

{
  "refreshToken": "THIRD_PARTY_REFRESH_TOKEN",
  "previousAccessToken": "PREVIOUS_THIRD_PARTY_ACCESS_TOKEN"
}
```

Success:

```json
{
  "data": {
    "accessToken": "NEW_THIRD_PARTY_ACCESS_TOKEN"
  }
}
```

Refresh token rotation is not implemented because Publ's fixed parser expects
only a new access token from refresh. The refresh token is hashed before storage
and never returned by refresh.

Safe error shape:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid api key or token"
  }
}
```

Endpoint errors must not echo raw Publ JWTs, local access tokens, refresh tokens,
API keys, outgoing secrets, token secrets, or request bodies.

## iframe Client

`/publ-client` is an iframe-only bootstrap entry for the Publ Seller Console. It
does not render the standalone landing page or Clerk login controls.

The client loads the Publ SDK and follows the Seller-side pipeline flow from the
handoff kit:

```js
const client = PAppClientSDK.create('SELLER_SIDE');

await client.mount({ clientHash, pAppCode });
await client.pipeline.authorize(permissionIds);
await client.pipeline.request('PM_00000_EXCHANGE_TOKEN');
await client.pipeline.request('PM_00000_REFRESH_TOKEN');
```

When exchange succeeds it stores VIZUO access/refresh tokens in iframe
`sessionStorage`, attaches `Authorization: Bearer {accessToken}` to same-origin
`/api/*` relay calls, and renders the existing messaging console in embed mode.
When the local access token expires, the client asks the SDK for
`PM_00000_REFRESH_TOKEN`; the SDK includes the previous access/refresh token from
its session, and VIZUO returns only the next access token.

The SDK adapter also exposes generic tap requests for granted Publ permissions.
Current helpers cover seller business information
`PM_00002_READ_SELLER_BUSINESS_INFORMATION` and member contacts
`PM_00002_READ_MEMBER_CONTACTS` once Publ confirms those permission IDs.

If the Publ SDK is unavailable locally, `/publ-client` renders a safe connection
unavailable state instead of attempting a raw `postMessage` protocol.

## Publ Automation Webhook

`POST /api/open/v1/publ/events` receives Publ automation events. It validates
the existing HMAC headers before parsing JSON:

```http
x-publ-timestamp: {unix_seconds|unix_millis|iso_date}
x-publ-signature: {hex_hmac_sha256}
```

The signature is:

```text
HMAC_SHA256(PUBL_OPEN_API_WEBHOOK_SECRET, "{timestamp}.{raw_body}")
```

The route accepts `sha256={hex}` or raw hex signatures and rejects timestamps
outside the five-minute replay window. Unsigned or invalid requests return:

```json
{
  "ok": false,
  "status": "rejected",
  "reasonCode": "invalid_signature"
}
```

## Smoke Tests

Run the app locally with server-only test values and a local database. The dev
server must be started from a shell that has the same values used by the smoke
commands:

```bash
export PUBL_OPEN_API_WEBHOOK_SECRET=test-only-open-api-webhook-secret
export PUBL_PAPP_TEST_OUTGOING_API_KEY=test-only-api-key
export PUBL_PAPP_TEST_OUTGOING_SECRET_KEY=test-only-outgoing-secret
export PUBL_PAPP_ACCESS_TOKEN_SECRET=test-only-local-access-secret
export PUBL_PAPP_REFRESH_TOKEN_HASH_SECRET=test-only-refresh-hash-secret
export PUBL_PAPP_CLIENT_STAGE=test
export PUBL_PAPP_TEST_CLIENT_HASH=test-only-client-hash
export PUBL_PAPP_SDK_SRC=/vendor/publ-p-app-client-sdk.testflight.js

npm run dev
```

Unsigned webhook rejection:

```bash
curl -i http://127.0.0.1:3000/api/open/v1/publ/events \
  -H "content-type: application/json" \
  -d '{"eventKey":"order.created","externalEventId":"evt_smoke","channelCode":"store_1","payload":{}}'
```

Expected result: HTTP `401` and `reasonCode: "invalid_signature"`.

Test-only token exchange from another shell with the same exported test values:

```bash
JWT="$(node --input-type=module <<'NODE'
import { signHmacJwt, PUBL_PAPP_TOKEN_CONSTANTS } from './src/server/publPapp/tokens.js';

const claim = {
  channelCode: 'SMOKE_STORE',
  channelId: 1,
  consumerId: 'smoke-consumer-1',
  distinctId: 'smoke-profile-1',
  installedPAppId: 1,
  pAppCode: '3RD_A00003_TEST',
  role: 'OWNER',
};

console.log(signHmacJwt({
  claim,
  iss: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
  sub: `Consumer:${claim.consumerId}`,
}, {
  expiresInSeconds: 900,
  secret: process.env.PUBL_PAPP_TEST_OUTGOING_SECRET_KEY,
}));
NODE
)"

curl -i "http://127.0.0.1:3000/integrations/exchange-token?apiKey=$PUBL_PAPP_TEST_OUTGOING_API_KEY" \
  -H "authorization: Bearer $JWT" \
  -H "content-type: application/json" \
  -d '{}'
```

Expected result with database connectivity: HTTP `200` and a `{ "data": ... }`
body containing `accessToken` and `refreshToken`. Use test-only values only.
