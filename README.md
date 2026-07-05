# Messaging App

Next.js App Router messaging console with an NHN relay server scaffold.

Included:

- Next.js App Router
- Clerk dependency and environment placeholders
- Postgres dependency path for VPS/self-hosted DB
- Drizzle ORM domain schema for relay ownership, sender resources, settlement, evidence metadata, and audit logs
- NHN direct product API wrappers for SMS API v3.0 and KakaoTalk Bizmessage AlimTalk API v2.3
- Server routes for sender resource approval, template lookup, send relay, log proxy, resend/export, and settlement aggregation
- Docker Compose
- Caddy reverse proxy
- Worker evidence cleanup loop

Intentionally not included yet:

- Auth routes or middleware
- Notion integration schema
- Drizzle Kit migration scripts, until schema decisions are made
- Pricing or money calculation

Operational docs:

- `docs/NHN_RELAY_SERVER_DESIGN.md`
- `docs/NHN_RELAY_OPERATIONS.md`
- `docs/DB_SCHEMA.md`

## Local dev

```bash
npm install
npm run dev
```

## Docker/VPS shape

```bash
cp .env.example .env
docker compose up --build
```

The app runs behind Caddy, Postgres is internal to the compose network, and `worker` performs scheduled private evidence cleanup.
