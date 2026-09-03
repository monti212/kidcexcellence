-- Kidcellence billing — Stripe subscriptions, one-off payments, webhook log.
--
-- Follows the same split as 0001: narrow, queryable entities get real columns.
-- Subscriptions and payments are both narrow and are aggregated by the admin
-- dashboard, so neither is a jsonb document.
--
-- Like every other table here, RLS is enabled with no policies: only the
-- server-side secret key reaches this data. Billing rows are the last thing
-- that should be readable with a publishable key.

-- Stripe customer id lives on the account so a user never accumulates more than
-- one Stripe customer across checkouts.
alter table public.platform_users
  add column if not exists stripe_customer_id text;

create unique index if not exists platform_users_stripe_customer_id_idx
  on public.platform_users (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.platform_subscriptions (
  stripe_subscription_id text primary key,
  user_id                text not null references public.platform_users (id) on delete cascade,
  plan_id                text not null check (plan_id in ('parent', 'care-worker', 'provider')),
  status                 text not null,
  stripe_customer_id     text not null,
  stripe_price_id        text,
  -- Major currency units (BWP 60), matching the plan catalogue in
  -- lib/billing-plans.ts. Stripe's minor units are converted at the boundary.
  amount                 numeric(12, 2) not null default 0,
  currency               text not null default 'BWP',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  started_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  canceled_at            timestamptz
);

create index if not exists platform_subscriptions_user_id_idx
  on public.platform_subscriptions (user_id);
create index if not exists platform_subscriptions_status_idx
  on public.platform_subscriptions (status);

create table if not exists public.platform_payments (
  id                       text primary key,
  user_id                  text not null references public.platform_users (id) on delete cascade,
  kind                     text not null check (kind in ('subscription', 'verification', 'vetting')),
  description              text not null default '',
  amount                   numeric(12, 2) not null default 0,
  currency                 text not null default 'BWP',
  status                   text not null check (status in ('paid', 'failed', 'refunded')),
  stripe_customer_id       text,
  stripe_session_id        text,
  stripe_invoice_id        text,
  stripe_payment_intent_id text,
  package_id               text,
  created_at               timestamptz not null default now()
);

create index if not exists platform_payments_user_id_idx
  on public.platform_payments (user_id, created_at desc);
create index if not exists platform_payments_created_at_idx
  on public.platform_payments (created_at desc);
create index if not exists platform_payments_status_idx
  on public.platform_payments (status);

-- Applied Stripe event ids. Stripe retries on any non-2xx response and may
-- deliver the same event more than once; applyBillingEvent() gates on this.
create table if not exists public.platform_stripe_events (
  event_id     text primary key,
  processed_at timestamptz not null default now()
);

alter table public.platform_subscriptions  enable row level security;
alter table public.platform_payments       enable row level security;
alter table public.platform_stripe_events  enable row level security;
