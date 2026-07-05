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

## Runtime

The compose stack contains:

- `migrate`: runs `npm run db:migration:apply`
- `web`: runs the Next.js app on port `3000`
- `worker`: runs `npm run worker`

`web` and `worker` wait for `migrate` to complete successfully.

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
- `EVIDENCE_STORAGE_DRIVER`
- `R2_ENDPOINT_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_EVIDENCE_BUCKET`
- `EVIDENCE_STORAGE_OBJECT_PREFIX`

For Supabase, use separate projects for dev and prod. On this Dokploy/Hetzner setup, prefer the Supabase session pooler URL on port `5432` for both runtime and migrations unless Docker IPv6 has been verified. Supabase direct URLs are often IPv6-only and can fail from Docker containers without IPv6 networking.

- runtime `DATABASE_URL`: session pooler URL
- migration `DATABASE_MIGRATION_URL`: session pooler URL, or direct URL only after IPv6 is confirmed

For first SSL issuance, keep Cloudflare DNS records as DNS-only. Cloudflare proxy can be enabled after Dokploy certificates are issued and the app is reachable.
