# Ledger Guard

Rule-based fraud and abuse detection for closed-loop stored value (loyalty points, store credit, gift cards) in high-SKU online retail. Built for IS4228 Technical Track, category: consumer or B2B fintech application.

Every fraud tool a merchant can buy scores the card leg of an order. Stored value has no AVS, no CVV, no chargeback, and the merchant is both issuer and ledger. Ledger Guard watches that ledger.

## What is in this repo

| Path | Owner in the story | What it is |
| --- | --- | --- |
| `services/ledger-guard` | Ledger Guard (the product) | Fastify service: ingest, adapters, event store, feature builder, YAML rule pack, decision service, alerts and rules API |
| `apps/merchant-api` | A merchant | The store's own backend: auth with password reset, stored-value ledger, gift cards, checkout that calls Ledger Guard before Stripe, refunds, demo reset |
| `apps/storefront` | A merchant | Customer-facing store (Next.js) |
| `apps/dashboard` | A merchant using Ledger Guard | Live feed, review queue, alert detail, account view, rules screen, demo control |
| `packages/events` | Shared | Common event model (zod) |
| `packages/data` | Demo tooling | Synthetic 90-day grocer, labelled fraud scenarios, replayer, precision and recall report |

## How it detects

No statistical model. Three layers:

1. Features: counters per customer, device, instrument and address over 1h, 24h, 7d and 90d windows, computed from the event store (`services/ledger-guard/src/engine/features.ts`).
2. Rules: predicates over features with a weight and severity, in `services/ledger-guard/src/rules/pack.yaml`. Thresholds can be literals or `p95:<stat>`, a percentile of the store's own history.
3. Decision: score = sum of fired weights. Block at 60 or any critical, review at 30, allow otherwise. Every fired rule carries its evidence.

## Run locally

Requirements: Node 22, pnpm 10, Docker.

```bash
pnpm install
pnpm db:up                       # Postgres (two databases: merchant, ledger_guard) and Mailpit (inbox at http://localhost:8025)
cp .env.example services/ledger-guard/.env
cp .env.example apps/merchant-api/.env
pnpm db:push                     # create tables in both databases
pnpm dev                         # all apps: storefront :3000, dashboard :3001, merchant-api :4000, ledger-guard :4100
```

Load the baseline and score it:

```bash
pnpm data:generate               # writes packages/data/out/events.jsonl and labels.json
pnpm data:replay -- --reset      # streams events into Ledger Guard in time order
pnpm data:report                 # precision and recall against the injected scenarios
```

Seed the demo accounts in the merchant API:

```bash
curl -X POST localhost:4000/admin/reset -H 'content-type: application/json' -d '{"seed":true,"resetLedgerGuard":false}'
```

## Demo accounts

See `apps/merchant-api/src/routes/admin.ts`. `dana@example.com` is the dormant victim with balances; `jj.quick@example.com` is the mule created yesterday; `sam@example.com` is a normal shopper. Password for all: `password123`.

## Environment

Copy `.env.example`. Stripe runs in test mode (`sk_test_`); without a key the merchant API fakes the PaymentIntent so the flow still runs.

Email goes over SMTP to Mailpit by default (`MAIL_TRANSPORT=smtp`), which catches mail to any address and shows it at http://localhost:8025, so the password-reset flow is real and the inbox is shareable. `MAIL_TRANSPORT=resend` switches to Resend over HTTPS; its free tier only delivers to the account owner, so set `RESEND_TO_OVERRIDE`. Every send is also recorded at `/outbox` on the storefront.

IP geolocation: in production the merchant's edge supplies `cf-ipcountry` or a geo-IP lookup runs; the demo accepts `x-demo-country` and `x-demo-network` headers, which the storefront sets from the "network" picker in its header, so a rehearsal can show a login from a foreign VPN.

## Deploy (Railway)

One Railway project, six services.

1. Postgres plugin. In its Data tab run `create database merchant; create database ledger_guard;`.
2. Mailpit: new service from Docker image `axllent/mailpit`, public domain on port 8025.
3. Four services from this GitHub repo. For each: root directory stays `/` (the Dockerfiles need the whole workspace), and Settings, Config-as-code path points at the service's file: `services/ledger-guard/railway.json`, `apps/merchant-api/railway.json`, `apps/dashboard/railway.json`, `apps/storefront/railway.json`. Give the engine, merchant API, dashboard and storefront each a public domain.

Variables (set before the first deploy; `NEXT_PUBLIC_*` are baked in at build time):

| Service | Variables |
| --- | --- |
| ledger-guard | `LG_DATABASE_URL` = Postgres URL with database `ledger_guard` |
| merchant-api | `MERCHANT_DATABASE_URL` (database `merchant`), `LEDGER_GUARD_URL` = `http://${{ledger-guard.RAILWAY_PRIVATE_DOMAIN}}:${{ledger-guard.PORT}}`, `STOREFRONT_URL` = storefront public URL, `STORE_ID` = `demo-grocer`, `STRIPE_SECRET_KEY`, `MAIL_TRANSPORT` = `smtp`, `SMTP_HOST` = `${{mailpit.RAILWAY_PRIVATE_DOMAIN}}`, `SMTP_PORT` = `1025` |
| storefront | `NEXT_PUBLIC_MERCHANT_API_URL`, `NEXT_PUBLIC_MAILBOX_URL` (public URLs) |
| dashboard | `NEXT_PUBLIC_LEDGER_GUARD_URL`, `NEXT_PUBLIC_MERCHANT_API_URL`, `NEXT_PUBLIC_STORE_ID` |

Both Fastify services run `drizzle-kit push` on start, so tables are created on first deploy. Load the baseline from your laptop against the deployed engine: `LEDGER_GUARD_URL=https://<engine domain> pnpm data:replay -- --reset`, then seed the merchant from the dashboard's demo control.

## Scope and trade-offs

In: fifteen rules, store-relative thresholds, sync decision on checkout, async alerts on every other event, four dashboard screens, five labelled scenarios.

Out, by design: machine learning, case management, real Shopify app install (the Shopify adapter maps webhook payloads but is exercised by the simulator), multi-tenant auth, notifications, in-store events, open-loop prepaid cards, EBT.
