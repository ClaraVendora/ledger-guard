# Ledger Guard

Rule-based fraud and abuse detection for closed-loop stored value (loyalty points, store credit, gift cards) in high-SKU online retail.

IS4228 Technical Track, Build Project. Category: consumer or B2B fintech application.

## What problem this solves

- A merchant that runs loyalty points, store credit and gift cards is the issuer and the ledger for all three
  - no bank, card network or payment processor sees a redemption
  - there is no AVS, no CVV, no 3DS and no chargeback on stored value
  - a fraudulent redemption is a final loss
- Every fraud tool a merchant can buy (Shopify Fraud Analysis, Stripe Radar, Signifyd, NoFraud, Forter) scores the card leg of the order
  - stored value is treated as already paid
  - an order that is USD 380 stored value and USD 20 card is scored on the USD 20
- Ledger Guard scores the stored-value ledger itself
  - it watches issue, load, transfer, redeem and reverse events, plus the auth and order events around them
  - it returns allow, review or block before the merchant charges the card or debits the balance

## What it does (the single primary function)

Input: an event from the merchant's commerce stack (order, refund, login, password reset, value issued, loaded, transferred, redeemed).

Output: a decision (allow / review / block), a score, the rules that fired, and the evidence rows behind each rule.

- The merchant API calls Ledger Guard synchronously on checkout and acts on the decision
  - block: no payment is taken, no stored value is debited, the customer sees a block screen
  - review: the order goes through and lands in the merchant's review queue
  - allow: the order goes through
- Every other event is scored asynchronously and shows up on the dashboard feed

## How detection works

There is no machine learning. Three layers, each one readable line by line.

1. Features
   - counters and ratios per customer, device, instrument and address over 1h, 24h, 7d and 90d windows
   - computed from the event store with plain SQL (`services/ledger-guard/src/engine/features.ts`)
   - examples: `hours_since_reset`, `stored_value_share`, `distinct_accounts_per_device_30d`, `refund_value_ratio_90d`, `ip_country_is_new`
2. Rules
   - a rule is a list of conditions over features, plus a weight and a severity (`services/ledger-guard/src/rules/pack.yaml`)
   - a threshold is a literal, or `p95:<stat>` which resolves to the 95th percentile of the store's own history, so a busy store is not penalised for being busy
   - fifteen rules in four groups, by where the value entered the ledger: issuance, load, takeover, laundering
3. Decision
   - score = sum of the weights of the rules that fired
   - block if score >= 60 or any critical rule fired; review if score >= 30; allow otherwise
   - every fired rule carries the feature values that made it fire, so the merchant sees why

## What is in this repo

| Path | Who it belongs to in the story | What it is |
| --- | --- | --- |
| `services/ledger-guard` | Ledger Guard, the product | Fastify service: ingest, adapters, event store, feature builder, rule pack, decision service, alerts and rules API |
| `apps/merchant-api` | A merchant | The store's own backend: auth with password reset, stored-value ledger, gift cards, checkout that calls Ledger Guard before Stripe, refunds, demo reset |
| `apps/storefront` | A merchant | Customer-facing store (Next.js), port 3000 |
| `apps/dashboard` | A merchant using Ledger Guard | Live feed, review queue, alert detail, account view, rules screen, demo control (Next.js), port 3001 |
| `packages/events` | Shared | Common event model (zod schemas) that every adapter maps into |
| `packages/data` | Demo tooling | Synthetic 180-day grocer, labelled fraud scenarios, replayer, precision and recall report |
| `deploy` | Deployment | Dockerfiles used by `docker-compose.prod.yml` and Railway |
| `scripts` | Local setup | Postgres init SQL |

## Dependencies

- Node 22
- pnpm 10 (`corepack enable && corepack prepare pnpm@10.28.0 --activate`)
- Docker Desktop, for Postgres 16 and Mailpit locally
- Optional: a Stripe account in test mode. Without a key the merchant API fakes the PaymentIntent and the flow still runs end to end

No domain, no Shopify partner account and no third-party fraud service are needed.

## Run locally

```bash
pnpm install
pnpm db:up                       # Postgres (databases: merchant, ledger_guard) and Mailpit (inbox at http://localhost:8025)
cp .env.example services/ledger-guard/.env
cp .env.example apps/merchant-api/.env
cp .env.example apps/dashboard/.env
cp .env.example apps/storefront/.env
pnpm db:push                     # creates the tables in both databases
pnpm dev                         # storefront :3000, dashboard :3001, merchant-api :4000, ledger-guard :4100
```

Then, in a second terminal, load the baseline and seed the demo accounts:

```bash
pnpm data:generate -- --customers 300     # writes packages/data/out/events.jsonl and labels.json
pnpm data:replay -- --reset               # streams the events into Ledger Guard in time order, about 3 minutes
# or: dashboard, Demo control, "Replay baseline". Same data, generated inside the engine, no terminal needed
pnpm data:report                          # precision and recall against the injected scenarios
```

Then open http://localhost:3001/admin and click "Reset merchant (keep baseline)". This seeds the catalogue and the three demo accounts.

- Why 300 customers: the replayer runs at about 150 events a second. 300 customers over 180 days is about 21,000 events. 2,000 customers is about 140,000 events and takes 15 minutes; use it once before the presentation if you want the bigger number on screen

## Run the production images locally

Same Dockerfiles as Railway. If this comes up, the Railway deploy will too.

```bash
pnpm db:up
docker compose -f docker-compose.prod.yml up --build
```

## Demo accounts

All passwords are `password123`. Defined in `apps/merchant-api/src/routes/admin.ts`.

| Email | Role in the demo |
| --- | --- |
| `dana@example.com` | The victim. Real customer, 10 past orders, dormant for 100 days, USD 310 credit, 220 points, a USD 100 gift card |
| `jj.quick@example.com` | The mule. Account created yesterday, USD 150 credit from a refund claim |
| `sam@example.com` | The control. Shops weekly, nothing unusual |

## Demo script (the 4 to 5 minute live section)

Two browser windows: the dashboard (merchant) and the storefront (customer). The storefront's device id is per browser, so an incognito window reads as a new device without any faking.

1. Dashboard, live feed. Baseline is quiet
2. Storefront, normal window: log in as Sam, buy cheese and bread with a few points. Feed shows allow
3. Storefront, incognito window: set the network picker in the header to "NG via VPN". Forgot password for `dana@example.com`. Open the Inbox link (Mailpit), click the reset link, set a new password. Feed shows reset and new device
4. Same incognito window, second tab: log in as `jj.quick@example.com`, send USD 150 credit to Dana. Feed shows block on the transfer
5. Back on Dana's tab: add a new address, cart, "load the wine order", checkout. Stored value covers most of the USD 403; the card covers the rest (about USD 20 if you set credit to 165). Checkout returns the block screen
6. Dashboard: open the alert. Walk the fired rules and the timeline, which shows every step from the burner device. Then Rules: raise the `redeem_after_reset` stored-value threshold and watch the counts change across the whole history

Before the real run: Demo control, "Replay baseline" (about 3 minutes, wipes the store first), then "Reset merchant". This makes Dana dormant again and clears rehearsal noise from the timeline.

## Environment variables

Every value lives in `.env.example`. Copy it per app; `.env` files are git-ignored.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `LG_DATABASE_URL` | ledger-guard | Postgres URL, database `ledger_guard` |
| `MERCHANT_DATABASE_URL` | merchant-api | Postgres URL, database `merchant` |
| `LEDGER_GUARD_URL` | merchant-api | Where the merchant posts events |
| `STOREFRONT_URL` | merchant-api | Used in the password reset link |
| `STORE_ID` | merchant-api, dashboard | Tenant key, `demo-grocer` |
| `STRIPE_SECRET_KEY` | merchant-api | `sk_test_` key. Optional |
| `MAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT` | merchant-api | `smtp` to Mailpit by default. `resend` with `RESEND_API_KEY` and `RESEND_TO_OVERRIDE` also works; Resend's free tier only delivers to the account owner |
| `NEXT_PUBLIC_MERCHANT_API_URL` | storefront, dashboard | Public URL of merchant-api |
| `NEXT_PUBLIC_LEDGER_GUARD_URL` | dashboard | Public URL of ledger-guard |
| `NEXT_PUBLIC_MAILBOX_URL` | storefront | Public URL of Mailpit, for the Inbox link |
| `PORT` | both Fastify services | Set by Railway; falls back to `LG_PORT` / `MERCHANT_PORT` locally |

- Email: Mailpit catches mail to any address and shows it in a web inbox, so the password reset is a real email and the inbox is shareable with no domain
- IP geolocation: in production the merchant's edge supplies `cf-ipcountry` or a geo-IP lookup runs. The demo accepts `x-demo-country` and `x-demo-network` headers, set by the storefront's network picker, so a rehearsal can show a login from a foreign VPN

## Deploy to Railway

One Railway project, six services. Builder is Railpack; each service's `railway.json` carries its build and start command.

1. Postgres plugin
   - one database; each service creates its own schema (`ledger_guard`, `merchant`) on first start, nothing to run by hand
   - Settings, Networking, enable TCP Proxy so the baseline replay can be run from a laptop
2. Mailpit
   - New service from Docker image `axllent/mailpit`
   - Settings, Networking: generate a public domain on port 8025
3. Four services from this GitHub repo: `ledger-guard`, `merchant-api`, `dashboard`, `storefront`
   - Railway detects the four `railway.json` files and creates one service each; root directory stays `/`
   - generate a public domain for each; set the domain's target port to the port the deploy log says the app is listening on (Railway injects `PORT`, usually 8080)
   - if a service was created before the start command existed, set Settings, Deploy, Custom Start Command to `pnpm --filter <package> start:railway` for the two Fastify services and `pnpm --filter <package> start` for the two Next.js apps
4. Variables, per service

| Service | Variables |
| --- | --- |
| ledger-guard | `LG_DATABASE_URL` = `${{Postgres.DATABASE_URL}}` |
| merchant-api | `MERCHANT_DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, `LEDGER_GUARD_URL` = ledger-guard public URL, `STOREFRONT_URL` = storefront public URL, `STORE_ID` = `demo-grocer`, `STRIPE_SECRET_KEY`, `MAIL_TRANSPORT` = `smtp`, `SMTP_HOST` = `${{mailpit.RAILWAY_PRIVATE_DOMAIN}}`, `SMTP_PORT` = `1025` |
| storefront | `NEXT_PUBLIC_MERCHANT_API_URL`, `NEXT_PUBLIC_MAILBOX_URL` |
| dashboard | `NEXT_PUBLIC_LEDGER_GUARD_URL`, `NEXT_PUBLIC_MERCHANT_API_URL`, `NEXT_PUBLIC_STORE_ID` |

- `NEXT_PUBLIC_*` values are baked in at build time, so set them before the first build and redeploy the two frontends if a URL changes
- Both Fastify services run `drizzle-kit push` on start (`start:railway`), so tables are created on first deploy
- Load the baseline from a laptop against the deployed engine, then seed the merchant from the dashboard:
  - `LEDGER_GUARD_URL=https://<ledger-guard domain> pnpm data:generate -- --customers 300`
  - `LEDGER_GUARD_URL=https://<ledger-guard domain> pnpm data:replay -- --reset`
  - dashboard, Demo control, "Reset merchant (keep baseline)"
- Turbo filters out unknown environment variables, so if `drizzle-kit push` ever has to be run from a laptop, run it inside the service folder with `npx drizzle-kit push --force` and the Postgres public URL, not through `pnpm db:push`

## Scope and trade-offs

In scope

- fifteen rules, store-relative thresholds, sync decision on checkout, async alerts on every other event
- five dashboard screens, one storefront flow, five labelled scenarios with a precision and recall report
- a Shopify adapter that maps `orders/create`, `refunds/create` and `gift_cards/create` webhooks into the common event model

Out of scope, on purpose

- machine learning: the weights are set by hand; replacing them with a logistic regression over labelled alerts is the natural next step
- a real Shopify app install and OAuth: the adapter is exercised by the simulator, not a live store
- case management, notifications, multi-tenant auth
- in-store events, open-loop prepaid cards, EBT

## Results on the synthetic store

300 customers, 180 days, 21,000 events, 126 labelled fraud events across five scenarios: account takeover and drain, refund-to-credit farming, promo and referral linking, gift card enumeration, load and spend.

- precision 0.93, recall 0.96
- account takeover: 6 of 6 caught; the demo order scores 195 with five rules fired

Regenerate the numbers with `pnpm data:report`.
