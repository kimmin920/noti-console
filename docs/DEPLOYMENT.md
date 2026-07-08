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

After each successful dev image build, the workflow prunes old dev image
versions in GHCR. It keeps the latest three `sha-*` versions for each dev
package and always keeps the moving `:dev` tag. The cleanup intentionally only
deletes versions with `sha-*` tags; untagged package records are not deleted by
this workflow because container manifests and attestations can share package
version internals.

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

## Dev Deploy Trigger

After the dev app uses GHCR image pulls, do not rely on Dokploy's GitHub
auto-deploy trigger or the Dokploy deploy webhook for `noti-console-dev`. A
GitHub push can reach Dokploy before the GitHub Actions image build has pushed
the new `:dev` tags, causing Dokploy to redeploy the previous image
successfully. Dokploy also rejects deploy webhook requests when the service's
auto deploy toggle is disabled.

Use the image workflow as the single dev deploy trigger through the Dokploy API:

1. In Dokploy, open `noti-console-dev`, turn off the `Toggle autodeploy` switch,
   and keep the service connected to the `dev` branch.
2. Generate a Dokploy API key from the profile/API settings.
3. Add these GitHub Actions values:
   - Secret: `DOKPLOY_API_KEY`
   - Variable: `DOKPLOY_API_URL=https://dokploy.vizuo.work`
   - Variable: `DOKPLOY_DEV_COMPOSE_ID=<noti-console-dev compose id>`
4. Let `.github/workflows/docker-dev.yml` trigger
   `POST /api/compose.deploy` after both GHCR images are pushed and old dev
   image versions are pruned.

The dev image workflow is serialized per branch. If a newer `dev` image build
starts, GitHub Actions cancels the older in-progress run so an older workflow
cannot push or deploy a stale `:dev` tag after the newer run.

If the workflow fails with a missing Dokploy deploy value error, set the missing
GitHub secret or variable and re-run the latest `Build dev Docker images`
workflow for `dev`. If Dokploy deploys but `noti-dev` still shows an old build
timestamp, check the Dokploy deployment logs for GHCR pull/auth failures and
verify the running container image with:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

## Dev Image-Based Dokploy Rollout

After phase 61, `docker-compose.yml` is the Dokploy runtime Compose file. It
pulls prebuilt GHCR images and intentionally contains no service-level `build:`
configuration.

`docker-compose.build.yml` preserves the previous source-build flow as an
emergency fallback. Use it only when the GHCR image path is unavailable and the
VPS has enough spare memory to tolerate a source build.

Set these values in the dev Dokploy app before redeploying `noti-console-dev`:

```bash
APP_IMAGE=ghcr.io/kimmin920/noti-console:dev
MIGRATE_IMAGE=ghcr.io/kimmin920/noti-console-migrate:dev
```

`docker-compose.yml` fails fast when either image variable is missing. This is
intentional so prod cannot accidentally pull dev images through a default value.

If GHCR packages are private, the VPS must already be authenticated before the
redeploy:

```bash
docker login ghcr.io -u kimmin920
docker pull ghcr.io/kimmin920/noti-console:dev
docker pull ghcr.io/kimmin920/noti-console-migrate:dev
```

For rollback, set both image variables to matching immutable tags from the same
successful GitHub Actions image build:

```bash
APP_IMAGE=ghcr.io/kimmin920/noti-console:sha-<commit-sha>
MIGRATE_IMAGE=ghcr.io/kimmin920/noti-console-migrate:sha-<commit-sha>
```

Do not merge this image-based Compose flow to `main` or prod until a prod image
workflow exists and prod Dokploy env sets prod image tags. That prevents prod
from accidentally using dev images.

After redeploy, validate from the VPS:

```bash
date
uptime
free -h
df -h
docker system df
ps -eo pid,comm,args | grep "next build" | grep -v grep || true
docker ps
docker stats --no-stream
curl -I https://noti-dev.vizuo.work/message-send
```

A successful image-based deploy has no `next build` process on the VPS. Record
before/after resource values so the migration proves operational improvement,
not only functional availability.

## Resource Comparison Runbook

Use this runbook to confirm that GHCR image deployment solved the VPS resource
pressure. Run the commands over SSH or the Hetzner web console.

### Before Redeploy Snapshot

Capture the current idle baseline before switching or redeploying the
image-based Compose file. Do not intentionally run a source-build deploy to
reproduce the outage.

### After Image Redeploy Snapshot

Capture the same values immediately after Dokploy redeploys `noti-console-dev`.
The key check is that the app comes back without a `next build` process and
without memory collapsing to tens of MiB.

### Commands

```bash
date
uptime
free -h
df -h
docker system df
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
ps -eo pid,comm,%cpu,%mem,rss,args --sort=-%mem | head -20
ps -eo pid,comm,args | grep "next build" | grep -v grep || true
curl -I https://noti-dev.vizuo.work/
curl -I https://noti-dev.vizuo.work/message-send
```

### Comparison Table

| Metric | Before redeploy | After image redeploy | Success signal |
| --- | --- | --- | --- |
| load average |  |  | Does not spike into sustained double digits |
| memory available |  |  | Does not collapse to tens of MiB |
| swap used |  |  | Does not rapidly grow during redeploy |
| `next build` process present |  |  | `no` |
| largest process RSS |  |  | No unexpected build process dominates memory |
| `dokploy` memory |  |  | Stable after redeploy |
| `dockerd` memory |  |  | Stable after image pull |
| Docker image/cache size from `docker system df` |  |  | Track growth after pulling GHCR images |
| `noti-dev` HTTP status |  |  | `/` returns 200; `/message-send` returns 307 or 200 |

### Success Thresholds

- No `next build` process appears on the VPS during image-based redeploy.
- `noti-dev` returns HTTP 200 for `/` and 307 or 200 for `/message-send`.
- Available memory does not collapse to tens of MiB.
- Swap usage does not rapidly grow during redeploy.
- SSH and Dokploy remain responsive during redeploy.

### Failure Actions

- If GHCR pull fails, verify `docker login ghcr.io`.
- If `next build` appears, Dokploy is still using a build-based Compose file.
- If Compose fails with `APP_IMAGE is required` or `MIGRATE_IMAGE is required`,
  set those values in the Dokploy environment before redeploying.
- If memory collapses without `next build`, inspect `docker stats` for the
  largest container.
- If rollout fails, set `APP_IMAGE` and `MIGRATE_IMAGE` to a known-good
  `sha-*` tag or temporarily switch Dokploy back to `docker-compose.build.yml`.

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
