-- Kidcellence billing — Cloudflare D1 (SQLite) schema.
--
-- Port of supabase/migrations/0002_billing.sql. See the security note at the
-- top of 0001: these tables carry payment history and Stripe customer ids with
-- no row level security behind them.

-- NOT idempotent, unlike the rest of these migrations: SQLite has no
-- `add column if not exists`, so re-running this file errors with
-- "duplicate column name: stripe_customer_id". That error is safe to ignore on
-- a database that already has the column.
alter table platform_users add column stripe_customer_id TEXT;

create unique index if not exists platform_users_stripe_customer_id_idx
  on platform_users (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists platform_subscriptions (
  stripe_subscription_id TEXT primary key,
  user_id                TEXT not null references platform_users (id) on delete cascade,
  plan_id                TEXT not null check (plan_id in ('parent', 'care-worker', 'provider')),
  status                 TEXT not null,
  stripe_customer_id     TEXT not null,
  stripe_price_id        TEXT,
  -- Major currency units (BWP 60), matching lib/billing-plans.ts. Stripe's
  -- minor units are converted at the boundary in lib/stripe.ts.
  amount                 REAL not null default 0,
  currency               TEXT not null default 'BWP',
  current_period_end     TEXT,
  cancel_at_period_end   INTEGER not null default 0,
  started_at             TEXT not null,
  updated_at             TEXT not null,
  canceled_at            TEXT
);

create index if not exists platform_subscriptions_user_id_idx
  on platform_subscriptions (user_id);
create index if not exists platform_subscriptions_status_idx
  on platform_subscriptions (status);

create table if not exists platform_payments (
  id                       TEXT primary key,
  user_id                  TEXT not null references platform_users (id) on delete cascade,
  kind                     TEXT not null check (kind in ('subscription', 'verification', 'vetting')),
  description              TEXT not null default '',
  amount                   REAL not null default 0,
  currency                 TEXT not null default 'BWP',
  status                   TEXT not null check (status in ('paid', 'failed', 'refunded')),
  stripe_customer_id       TEXT,
  stripe_session_id        TEXT,
  stripe_invoice_id        TEXT,
  stripe_payment_intent_id TEXT,
  package_id               TEXT,
  created_at               TEXT not null
);

create index if not exists platform_payments_user_id_idx
  on platform_payments (user_id, created_at desc);
create index if not exists platform_payments_created_at_idx
  on platform_payments (created_at desc);
create index if not exists platform_payments_status_idx
  on platform_payments (status);

-- Applied Stripe event ids. Stripe retries on any non-2xx response and may
-- deliver the same event more than once; applyBillingEvent() gates on this.
create table if not exists platform_stripe_events (
  event_id     TEXT primary key,
  processed_at TEXT not null
);
