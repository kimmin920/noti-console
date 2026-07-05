# PRD: Messaging App

## Goal

Build a focused messaging console for sending, managing, and observing transactional and campaign messages.

## Users

- Operators who send messages and inspect delivery state.
- Developers who manage API keys, webhooks, domains, and integration settings.
- Team members who need a compact dashboard for message activity and configuration.

## Current Scope

- Console shell with sidebar navigation.
- Message send, campaigns, automations, templates, audience, metrics, domains, logs, API keys, webhooks, settings, profile, and docs pages.
- Development-only UI playground for extracted components.
- Stack scaffold for Clerk, Postgres, Drizzle ORM, Docker, Caddy, and a worker process.

## MVP Exclusions

- Real auth routes and middleware.
- User, workspace, and billing schema.
- NHN message sending implementation.
- Notion integration schema.
- Drizzle migration workflow.
- Production background jobs.

## Product Direction

The product should feel like a utilitarian operations console: compact, readable, predictable, and fast to scan.
