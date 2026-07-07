# Deployment

This project deploys to Dokploy on a Hetzner VPS with two Git branches and two Dokploy Compose apps.

## Environments

| Environment | Branch | Dokploy app | Domain |
| --- | --- | --- | --- |
| dev | `dev` | `noti-console-dev` | `noti-dev.vizuo.work` |
| prod | `main` | `noti-console-prod` | `noti.vizuo.work` |

Flow:

```text
feature/* -> dev -> main
              |      |
              |      prod deploy
              dev deploy
```

## Dokploy

Create two Docker Compose services from the GitHub repository:

- Repository: `kimmin920/noti-console`
- Compose path: `./docker-compose.yml`
- Dev branch: `dev`
- Prod branch: `main`

Add domains in the Dokploy Domains tab rather than hard-coding Traefik labels:

- Dev domain: `noti-dev.vizuo.work`, service `web`, port `3000`
- Prod domain: `noti.vizuo.work`, service `web`, port `3000`

Dokploy writes service environment variables to a `.env` file next to `docker-compose.yml`. The compose file uses `env_file: .env` so runtime variables are injected into the containers.

## Dev GHCR Image Bootstrap

The dev image rollout is intentionally split into two phases:

1. `60-ghcr-image-bootstrap`: build and publish GHCR images while Dokploy still
   uses the source-build Compose flow above.
2. `61-dokploy-image-compose`: switch the dev Dokploy Compose app to pull the
   published images.

Phase 60 publishes these dev images from the `dev` branch:

- `ghcr.io/kimmin920/noti-console:dev`
- `ghcr.io/kimmin920/noti-console-migrate:dev`

The workflow also publishes immutable SHA tags that can be used for rollback:

- `ghcr.io/kimmin920/noti-console:sha-<full-or-short-sha>`
- `ghcr.io/kimmin920/noti-console-migrate:sha-<full-or-short-sha>`

Configure these GitHub repository variables before relying on the dev image
workflow:

- `NEXT_PUBLIC_APP_URL_DEV`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV`
- `NEXT_PUBLIC_APP_VERSION` if the image should override the version from
  `package.json`

The workflow derives `NEXT_PUBLIC_BUILD_SHA`, `NEXT_PUBLIC_BUILD_SUBJECT`, and
`NEXT_PUBLIC_BUILD_TIME` from the checked-out commit and fails before building if
required public build values are missing.

If GHCR packages are private, log in on the VPS once with a token that has
`read:packages` access:

```bash
docker login ghcr.io -u kimmin920
```

Do not run `61-dokploy-image-compose` until both `:dev` GHCR images exist and
can be pulled from the VPS:

```bash
docker pull ghcr.io/kimmin920/noti-console:dev
docker pull ghcr.io/kimmin920/noti-console-migrate:dev
```

The success signal for phase 60 is that GitHub Actions can push both `:dev`
images. Dokploy should continue source builds until phase 61 switches Compose to
image pulls. After that switch, the VPS must not run `next build`; builds must
happen in GitHub Actions and deployment should only pull the already-built
images.

## Runtime

The compose stack contains:

- `migrate`: runs `npm run db:migration:apply`
- `web`: runs the Next.js app on port `3000`
- `worker`: runs `npm run worker`

`web` and `worker` wait for `migrate` to complete successfully.

## Build Version Badge

The console shows a compact build badge at the bottom of the left sidebar. By
default it displays the `package.json` version, for example `v0.1.0`, and shows
the git commit SHA, commit subject, and build timestamp on hover or click.

Dokploy does not need a runtime variable for this when the Docker build context
contains `.git`. If the platform strips git metadata, set these optional build
arguments/env values before building:

- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_BUILD_SHA`
- `NEXT_PUBLIC_BUILD_SUBJECT`
- `NEXT_PUBLIC_BUILD_TIME`

## Required Variables

Use separate values for dev and prod. Start from `.env.example`.

- `APP_ENV`
- `APP_DOMAIN`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `DATABASE_MIGRATION_URL`
- `NHN_SMS_APP_KEY`
- `NHN_SMS_SECRET_KEY`
- `NHN_SMS_WEBHOOK_SIGNATURE`
- `NHN_KAKAO_BIZMESSAGE_APP_KEY`
- `NHN_KAKAO_BIZMESSAGE_SECRET_KEY`
- `NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE`
- `PUBL_OPEN_API_WEBHOOK_SECRET`
- `PUBL_PAPP_TEST_CODE`
- `PUBL_PAPP_TEST_OUTGOING_API_KEY`
- `PUBL_PAPP_TEST_OUTGOING_SECRET_KEY`
- `PUBL_PAPP_RELEASE_CODE`
- `PUBL_PAPP_RELEASE_OUTGOING_API_KEY`
- `PUBL_PAPP_RELEASE_OUTGOING_SECRET_KEY`
- `PUBL_PAPP_ACCESS_TOKEN_SECRET`
- `PUBL_PAPP_REFRESH_TOKEN_HASH_SECRET`
- `PUBL_PAPP_CLIENT_STAGE`
- `PUBL_PAPP_SDK_SRC`
- `PUBL_PAPP_TEST_CLIENT_HASH`
- `PUBL_PAPP_RELEASE_CLIENT_HASH`
- `PUBL_PAPP_TEST_SELLER_INFO_PERMISSION_ID`
- `PUBL_PAPP_TEST_MEMBER_CONTACTS_PERMISSION_ID`
- `PUBL_PAPP_RELEASE_SELLER_INFO_PERMISSION_ID`
- `PUBL_PAPP_RELEASE_MEMBER_CONTACTS_PERMISSION_ID`
- `EVIDENCE_STORAGE_DRIVER`
- `R2_ENDPOINT_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_EVIDENCE_BUCKET`
- `EVIDENCE_STORAGE_OBJECT_PREFIX`

## Publ PApp

Publ receives these environment-specific URLs for the PApp SSO integration:

| Environment | OUTGOING_HOST | CLIENT_SRC | GRANTED_CLIENT_HOSTS | WEBHOOK_ENDPOINT_SRC |
| --- | --- | --- | --- | --- |
| dev | `https://noti-dev.vizuo.work` | `https://noti-dev.vizuo.work/publ-client` | `noti-dev.vizuo.work`, `localhost:3000`, `127.0.0.1:3000` | `https://noti-dev.vizuo.work/api/open/v1/publ/events` |
| prod | `https://noti.vizuo.work` | `https://noti.vizuo.work/publ-client` | `noti.vizuo.work` | `https://noti.vizuo.work/api/open/v1/publ/events` |

Use the test pApp code `3RD_A00003_TEST` for dev and the release pApp code
`3RD_A00003` for prod. Store Publ-issued outgoing API keys, outgoing secret
keys, and local token secrets only in server-side environment variables. Do not
publish them through `NEXT_PUBLIC_*`.

Client hash, SDK URL, and permission IDs are iframe client-visible
configuration, not server secrets. They still live in Dokploy env so the server
can choose the correct test/release values before rendering `/publ-client`.

Deployment checklist:

- Dev Dokploy app: set `PUBL_OPEN_API_WEBHOOK_SECRET`,
  `PUBL_PAPP_TEST_OUTGOING_API_KEY`,
  `PUBL_PAPP_TEST_OUTGOING_SECRET_KEY`, `PUBL_PAPP_ACCESS_TOKEN_SECRET`, and
  `PUBL_PAPP_REFRESH_TOKEN_HASH_SECRET`. Also set
  `PUBL_PAPP_CLIENT_STAGE=test`, `PUBL_PAPP_TEST_CLIENT_HASH`, and
  `PUBL_PAPP_SDK_SRC=/vendor/publ-p-app-client-sdk.testflight.js` unless Publ
  provides a hosted SDK URL. `PUBL_PAPP_TEST_CODE` may stay at the default
  `3RD_A00003_TEST`.
- Prod Dokploy app: set `PUBL_OPEN_API_WEBHOOK_SECRET`,
  `PUBL_PAPP_RELEASE_OUTGOING_API_KEY`,
  `PUBL_PAPP_RELEASE_OUTGOING_SECRET_KEY`, `PUBL_PAPP_ACCESS_TOKEN_SECRET`, and
  `PUBL_PAPP_REFRESH_TOKEN_HASH_SECRET`. Also set
  `PUBL_PAPP_CLIENT_STAGE=release`, `PUBL_PAPP_RELEASE_CLIENT_HASH`, and a
  release-approved `PUBL_PAPP_SDK_SRC`. `PUBL_PAPP_RELEASE_CODE` may stay at the
  default `3RD_A00003`.
- Set seller-info and member-contacts permission ID env values only after Publ
  confirms the stage-specific IDs granted to this PApp.
- Keep Publ `incoming_api_key` and `incoming_secret_key` out of this deployment
  until a future Server-to-Publ-Server integration explicitly uses them.
- Verify `/publ-client` is reachable from Publ's granted hosts and
  `/api/open/v1/publ/events` returns `invalid_signature` for unsigned requests
  before asking Publ to run end-to-end staging validation.
- Do not configure any Publ value through `NEXT_PUBLIC_*`.

See `docs/PUBL_PAPP_INTEGRATION.md` for token exchange and webhook smoke-test
commands.

For Supabase, use separate projects for dev and prod. On this Dokploy/Hetzner setup, prefer the Supabase session pooler URL on port `5432` for both runtime and migrations unless Docker IPv6 has been verified. Supabase direct URLs are often IPv6-only and can fail from Docker containers without IPv6 networking.

- runtime `DATABASE_URL`: session pooler URL
- migration `DATABASE_MIGRATION_URL`: session pooler URL, or direct URL only after IPv6 is confirmed

For first SSL issuance, keep Cloudflare DNS records as DNS-only. Cloudflare proxy can be enabled after Dokploy certificates are issued and the app is reachable.
