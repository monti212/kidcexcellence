# Kidcellence

Kidcellence is a Botswana childcare marketplace for parents and care providers. It includes provider discovery, side-by-side comparison, provider profiles, in-app messaging, parent/provider workspaces, and an admin verification workflow.

## Current Platform Shape

- Next.js App Router on Next `16.2.2`
- React `19.2.4`
- Tailwind CSS 4 with shadcn/Base UI primitives
- Branded marketplace UI with search, compare, profile, messaging, auth, parent, provider, and admin surfaces
- Route-handler API boundary under `app/api`
- Cloudflare D1 persistence through `lib/platform-store.ts`, with Supabase Postgres and a local JSON store as alternate drivers
- Stripe billing: monthly subscriptions, verification and vetting fees, Billing Portal, and a signed webhook
- Password hashing and HTTP-only session cookies for the current first-party auth flow
- Admin verification APIs protected by an admin session and `ADMIN_EMAILS` allowlist
- Basic in-memory rate limiting on auth, profile updates, message sends, and admin verification APIs
- Same-origin mutation checks for cookie-backed API writes
- Provider document and gallery uploads stored under the configured runtime uploads directory
- Baseline security headers configured through Next

## Persistence

`lib/platform-store.ts` exposes the only persistence API the rest of the app uses. It runs on one of three drivers, chosen in this order:

- **Cloudflare D1** — the production store, used whenever D1 credentials are set.
- **Supabase Postgres** — the previous store, used when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set and D1 is not.
- **Local JSON file** — the fallback at `PLATFORM_STORE_PATH`, for offline work and for the integration suite.

Set `PLATFORM_STORE_DRIVER` to `d1`, `supabase`, or `json` to force one explicitly. No API route or component changes between drivers; the driver sits behind `readStore()` and `updateStore()`.

### Cloudflare D1 setup

See [`d1/README.md`](d1/README.md) for the full picture. In short:

1. Apply the schema:

   ```bash
   npx wrangler d1 execute kidcexcellence-db --remote --file=./d1/migrations/0001_platform_store.sql
   npx wrangler d1 execute kidcexcellence-db --remote --file=./d1/migrations/0002_billing.sql
   ```

2. Deploy the proxy Worker and point the app at it:

   ```bash
   cd d1/proxy-worker
   npx wrangler secret put PROXY_TOKEN
   npx wrangler deploy
   ```

   ```bash
   D1_PROXY_URL=https://<worker>.workers.dev
   D1_PROXY_TOKEN=<the same secret>
   ```

**The proxy Worker is not optional in production.** D1's REST API — the other way in, configured with `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_API_TOKEN` — is rate limited by Cloudflare at 1200 requests per five minutes *across the whole account*, and each `readStore()` costs 14 of them. Use REST for local development, migrations, and scripts only.

**D1 has no row level security.** The Postgres schema enabled RLS with no policies on every table, so a leaked publishable key could read nothing. SQLite has no equivalent, so `CLOUDFLARE_API_TOKEN` and `D1_PROXY_TOKEN` are the only things standing in front of password hashes, live session tokens, certified ID copies, police clearances, and children's names and dates of birth. Scope them narrowly and never prefix either with `NEXT_PUBLIC_`.

### How writes work

`readStore()` loads the full store; `updateStore()` hands that store to a mutator and then writes back only the rows that actually changed, added, or were removed. Narrow entities (users, sessions, account tokens, uploads, subscriptions, payments) are real columns with foreign keys and indexes. The wide, frequently-extended documents (parent and provider profiles, conversations with their message threads, verification submissions) are JSON columns, because `normalizeStore()` already defaults their optional fields in application code and a column per field would drift every time one is added.

On D1, a batch runs as a single implicit transaction, so a multi-table write from `updateStore()` lands atomically. Concurrent writes to the *same* row are still last-write-wins.

D1 rejects any statement binding more than 100 parameters, so `writeD1Store()` chunks multi-row upserts against that ceiling.

## Local Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`ENABLE_DEMO_PROVIDERS=true` exposes the bundled sample listings for local
demonstrations. Leave it unset or set it to `false` in production so only
published provider-owned profiles appear publicly.

## Verification

```bash
npm run lint
npm test
npm run build
```

Use `npm run build` before deploying, then run `npm run start` for a production-like local server.
The integration test starts a temporary Next dev server, uses isolated runtime data paths, and exercises the auth, profile, messaging, admin verification, and upload APIs.

## Runtime Data

With Supabase configured, platform records live in Postgres and only uploaded provider files are written to `PLATFORM_UPLOADS_DIR`.

On the JSON fallback driver, the app also writes to `PLATFORM_STORE_PATH`, which defaults to:

```bash
./data/platform-store.json
```

For production hosts on that driver, set it to a writable mounted path, for example:

```bash
PLATFORM_STORE_PATH=/var/lib/kidcellence/platform-store.json
PLATFORM_UPLOADS_DIR=/var/lib/kidcellence/uploads
```

Uploads are still local files. Do not rely on the repository working directory as durable storage on serverless platforms: use a mounted volume, or move uploads to object storage.

## Billing

Stripe powers three things: the monthly subscriptions advertised on `/pricing`, the one-off provider verification fee, and the Standard/VIP vetting packages.

- `/billing` is the account-facing dashboard: current plan, renewal date, payment history, and a Billing Portal link for card changes and cancellation.
- `/admin/billing` is the platform view: MRR, active and past-due subscriptions, revenue split by source, subscribers, and recent payments.

### What costs what

| Who | Subscription | Verification |
| --- | --- | --- |
| Parents / guardians | P60 / month | none |
| Nannies, helpers, babysitters | P60 / month | P20 (optional) |
| All other providers | P150 / month | P50 (optional) |

Verification is optional and buys the Verified badge; it is not required to publish a profile. Nannies, helpers, and babysitters may instead buy a **Vet With Us** package — Standard P795 or VIP P995 — which covers verification and adds managed vetting. The package is an upgrade, never a requirement.

Plan prices live in `lib/billing-plans.ts` and verification fees in `lib/verification-requirements.ts`, both keyed off the same care-worker category set so a provider's subscription tier and verification fee cannot drift apart. Setting `STRIPE_PRICE_*` makes Stripe own the price instead; without it, checkout builds an inline recurring price from the catalogue, so a fresh Stripe account works with no products pre-created.

### Going live

1. Create the product catalogue. Without this, checkout falls back to inline
   `price_data` and Stripe creates a **new Product on every checkout**, which
   fills the catalogue with duplicates and breaks Dashboard revenue reporting.

   ```bash
   STRIPE_SECRET_KEY=rk_test_... node scripts/stripe-setup.mjs   # sandbox first
   STRIPE_SECRET_KEY=rk_live_... node scripts/stripe-setup.mjs
   ```

   The script is idempotent — Products use deterministic ids and Prices use
   lookup keys — so re-running it reports `exists` rather than duplicating. It
   prints the `STRIPE_PRICE_*` lines to add to your environment.

2. Use a **restricted key** (`rk_`), not a secret key (`sk_`). Grant write on
   Customers, Checkout Sessions, Billing Portal, Products, and Prices, and read
   on Subscriptions and Invoices. Keep it in your host's secrets vault.

3. Set `STRIPE_WEBHOOK_SECRET` and create the webhook endpoint (see below).

4. Enable the **Customer Portal** in the Dashboard (Settings → Billing →
   Customer portal), separately in test and live mode. Until you do,
   `billingPortal.sessions.create` fails and the "Manage billing" button on
   `/billing` errors even with valid keys.

### Secret scanning

A pre-commit hook blocks Stripe, Supabase, and Cloudflare credentials, and any
`.env` file other than `.env.example`. Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

### Stripe Tax

`automatic_tax` is not enabled. Stripe collects no tax and raises no error until
you hold an active tax registration, so switching it on alone changes nothing.
Botswana VAT is not covered by Stripe Tax's supported jurisdictions, so treat
tax as a manual process here and confirm treatment with an accountant before
charging cross-border customers.

### Connect and Invoicing are not built yet

Connect has a hard constraint worth knowing before you plan around it: of
Stripe's 57 Connect platform countries, **only a US platform can onboard
Botswana connected accounts**, and those accounts get the `transfers` capability
only (Express or custom, recipient service agreement). Botswana and South Africa
are both absent from the platform-country list entirely.

In practice that means: a US-registered Kidcellence entity, Kidcellence collects
every card payment on its own account, and providers receive money by transfer.
Providers can never process their own cards. Verify against
`https://docs.stripe.com/_endpoint/get-platform-countries` before committing to
a structure.

### The webhook is the only writer of paid state

`app/api/stripe/webhook/route.ts` is the sole path that marks anything paid. Checkout routes only ever create a session and return its URL, because a browser redirect can be abandoned, replayed, or forged. The route:

- verifies the Stripe signature over the raw request body, and returns 503 if `STRIPE_WEBHOOK_SECRET` is unset rather than trusting an unverified payload;
- skips the same-origin guard used elsewhere, since Stripe posts cross-origin — the signature check replaces it;
- applies each event exactly once, gating on `platform_stripe_events` inside the same `updateStore()` pass that applies the change, so a retried delivery cannot double-apply.

Local testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Without Stripe configured

Checkout and portal routes return 503. The verification fee falls back to recording itself as paid with no money moving, which keeps the flow testable offline — and is blocked when `NODE_ENV=production`, so it cannot hand out paid status on a live deployment.

### Stripe availability in Botswana

Stripe does not offer merchant accounts in Botswana. The account must be registered in a supported country; BWP still works as a presentment currency, so customers are charged in Pula while settlement happens elsewhere.

## Admin Access

Set `ADMIN_EMAILS` to a comma-separated list of emails allowed to create or use admin accounts. The first successful admin sign-in for an allowlisted email creates the admin account in the runtime store.

## API Routes

- `GET /api/providers`
- `GET /api/providers/:id`
- `GET /api/compare?ids=1,2,5`
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/admin/verifications`
- `PATCH /api/admin/verifications`
- `GET /api/auth`
- `POST /api/auth`
- `DELETE /api/auth`
- `POST /api/auth/verify-email`
- `POST /api/auth/reset-password`
- `GET /api/profiles/parent`
- `POST /api/profiles/parent`
- `GET /api/profiles/provider`
- `POST /api/profiles/provider`
- `GET /api/billing`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/stripe/webhook`
- `GET /api/admin/billing`
- `GET /api/uploads`
- `POST /api/uploads`
- `GET /api/uploads/:id`
- `DELETE /api/uploads/:id`

## Production Readiness Notes

Before the platform is considered fully production complete:

- Connect password reset and email verification to a production email provider, then add CSRF token rotation, finer-grained admin permissions, and distributed rate limiting.
- Move provider uploads from local disk to durable object storage for serverless production. Cloudflare R2 is the natural fit now that the store is on D1.
- Add automated end-to-end tests for auth, search, compare, messaging, profile saving, and admin verification.
- Expand automated browser coverage for search, compare, provider profile editing, and responsive UI flows.
- Push filtering and sorting into the database. The store still loads every row and filters in JavaScript, which is fine at demo scale and will not stay so. This is the single biggest constraint on the D1 driver, because every read costs 14 statements.
- Deploy the D1 proxy Worker before any production traffic. The REST transport cannot carry it; see `d1/README.md`.
- Replace the row level security that Postgres provided and D1 does not. Today the D1 tokens are the only access control over ID documents, police clearances, and children's data.
- Give the read-modify-write cycle in `updateStore()` real concurrency control before meaningful write traffic. D1 batches make each write atomic, but two readers can still interleave.
- Confirm the Stripe account country. Stripe has no Botswana entity, so the account must be registered elsewhere.
- Give `nurseries` a home in the category facets. `CORE_SERVICE_CATEGORIES` excludes it (it also exists as a subcategory of `schools`) and `ADDITIONAL_PLATFORM_CATEGORIES` does not contain it, so nursery providers appear in no facet on `/api/providers` and cannot be found by browsing categories. Either surface it as its own facet or count those providers under `schools`.
- Replace the `user-${Date.now()}` account id with a collision-free id. Two signups in the same millisecond currently produce the same id.
