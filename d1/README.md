# Cloudflare D1

The platform store's production driver. `lib/platform-store-d1.ts` implements
the same read-snapshot / diff-write contract as the Supabase driver, so no API
route or component changes between them.

## Schema

`migrations/` is the SQLite port of `supabase/migrations/`. Table and column
names are identical, so the two drivers stay directly comparable.

```bash
npx wrangler d1 execute kidcexcellence-db --remote --file=./d1/migrations/0001_platform_store.sql
npx wrangler d1 execute kidcexcellence-db --remote --file=./d1/migrations/0002_billing.sql
```

`0001` is idempotent. `0002` is not: SQLite has no `add column if not exists`,
so re-running it fails with `duplicate column name: stripe_customer_id`. That
error is safe to ignore on a database that already has the column.

## Two ways in, and why the proxy is the production one

D1 has no wire protocol. You reach it through a Workers binding or over HTTP.

**REST API** (`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_D1_DATABASE_ID` +
`CLOUDFLARE_API_TOKEN`) needs no extra deployment, which makes it right for
local development, migrations, and scripts. It is not viable in production:
Cloudflare documents it as "best suited for administrative use, as the global
Cloudflare API rate limit applies", and that limit is **1200 requests per five
minutes for the entire account**. `readStore()` issues 14 statements per call
and the REST transport cannot batch them, so a handful of concurrent visitors
exhausts the account's budget.

**Proxy Worker** (`D1_PROXY_URL` + `D1_PROXY_TOKEN`) is the production path.
`proxy-worker/` holds a Worker that owns the real D1 binding and runs a whole
batch through `env.DB.batch()`. One HTTP request per store read or write, no
account-wide rate limit, and D1 executes the batch as a single transaction — so
a multi-table write from `updateStore()` now lands atomically, which the
Supabase driver's per-table upserts do not.

`lib/cloudflare-d1.ts` picks the proxy whenever `D1_PROXY_URL` and
`D1_PROXY_TOKEN` are both set, and falls back to REST otherwise.

### Deploying the proxy

```bash
cd d1/proxy-worker
openssl rand -hex 32              # use this value for both commands below
npx wrangler secret put PROXY_TOKEN
npx wrangler deploy
```

Then set `D1_PROXY_URL` to the deployed Worker URL and `D1_PROXY_TOKEN` to the
same secret in the app's environment.

## Security: no row level security

The Postgres schema enabled RLS with no policies on every table, so even a
leaked publishable key could read nothing. **D1 has no equivalent.** The only
thing in front of this data is the API token or the proxy token.

That matters here more than it would for most schemas:

- `platform_uploads` points at certified ID copies and police clearances.
- `platform_parent_profiles` holds children's names and dates of birth.
- `platform_users` holds password hashes; `platform_sessions` holds live tokens.

Treat `CLOUDFLARE_API_TOKEN` and `D1_PROXY_TOKEN` as the crown jewels: scope the
Cloudflare token to D1 edit on this database only, never prefix either with
`NEXT_PUBLIC_`, and rotate on any suspicion of exposure.

## Known constraints

- **100 bound parameters per statement.** D1 rejects more with "too many SQL
  variables". `writeD1Store()` chunks multi-row upserts against this, so a
  13-column table writes 7 rows per statement.
- **Whole-store reads.** `readStore()` still loads every row on every request,
  exactly as it did on Postgres. Unchanged by this migration, and still the
  first thing to fix before meaningful traffic.
- **Same-row concurrency.** Two writers touching the same row remain
  last-write-wins.
