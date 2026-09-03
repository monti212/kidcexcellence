-- Kidcellence platform store — Supabase Postgres schema.
--
-- This mirrors the PlatformStore shape in lib/platform-store.ts so the JSON
-- file store can be replaced without changing any API route contract.
--
-- Narrow, stable entities (users, sessions, tokens, uploads) get real columns
-- so they can be indexed and constrained. The wide, frequently-extended
-- documents (parent/provider profiles, conversations with their message
-- threads, verification submissions) are stored as jsonb: they carry dozens of
-- optional fields that normalizeStore() already defaults in application code,
-- and column-per-field mapping would drift silently every time a field is added.
--
-- Every table has RLS enabled with no policies. The app reaches Postgres only
-- through the server-side secret key, which bypasses RLS; the publishable key
-- therefore cannot read or write any of this data.

create table if not exists public.platform_users (
  id                text primary key,
  role              text not null check (role in ('parent', 'provider', 'admin')),
  name              text not null default '',
  email             text not null unique,
  phone             text,
  location          text,
  category          text,
  password_hash     text not null,
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz
);

create index if not exists platform_users_created_at_idx
  on public.platform_users (created_at desc);

create table if not exists public.platform_sessions (
  token      text primary key,
  user_id    text not null references public.platform_users (id) on delete cascade,
  role       text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists platform_sessions_user_id_idx
  on public.platform_sessions (user_id);
create index if not exists platform_sessions_expires_at_idx
  on public.platform_sessions (expires_at);

-- Sessions invalidated before their natural expiry (logout, password reset).
create table if not exists public.platform_revoked_session_tokens (
  token      text primary key,
  revoked_at timestamptz not null default now()
);

create table if not exists public.platform_account_tokens (
  token      text primary key,
  user_id    text not null references public.platform_users (id) on delete cascade,
  type       text not null check (type in ('email-verification', 'password-reset')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index if not exists platform_account_tokens_user_id_idx
  on public.platform_account_tokens (user_id, type);

create table if not exists public.platform_parent_profiles (
  user_id text primary key references public.platform_users (id) on delete cascade,
  data    jsonb not null default '{}'::jsonb
);

create table if not exists public.platform_provider_profiles (
  user_id text primary key references public.platform_users (id) on delete cascade,
  data    jsonb not null default '{}'::jsonb
);

-- Published provider profiles drive the public listings.
create index if not exists platform_provider_profiles_published_idx
  on public.platform_provider_profiles ((data ->> 'published'));

create table if not exists public.platform_uploads (
  id           text primary key,
  user_id      text not null references public.platform_users (id) on delete cascade,
  type         text not null check (type in ('document', 'gallery', 'profile-image', 'cover-image')),
  document_key text,
  label        text not null default '',
  file_name    text not null default '',
  content_type text not null default '',
  size         bigint not null default 0,
  path         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists platform_uploads_user_id_idx
  on public.platform_uploads (user_id, type);

create table if not exists public.platform_conversations (
  id         text primary key,
  created_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

create index if not exists platform_conversations_parent_idx
  on public.platform_conversations ((data ->> 'parentUserId'));
create index if not exists platform_conversations_provider_idx
  on public.platform_conversations ((data ->> 'providerUserId'));

create table if not exists public.platform_pending_verifications (
  id         text primary key,
  created_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

create table if not exists public.platform_approved_verifications (
  id         text primary key,
  created_at timestamptz not null default now(),
  data       jsonb not null default '{}'::jsonb
);

-- Scalar counters that have no natural row of their own (rejected_count).
create table if not exists public.platform_counters (
  key   text primary key,
  value bigint not null default 0
);

insert into public.platform_counters (key, value)
values ('rejected_count', 0)
on conflict (key) do nothing;

-- Seed the baseline approved verifications that the JSON store shipped in
-- createInitialStore(). providerIsApproved() matches these by display name, so
-- omitting them would silently un-verify the bundled demo providers.
insert into public.platform_approved_verifications (id, created_at, data)
values
  ('a1', '2025-03-15T00:00:00Z', '{"id":"a1","name":"Sunshine Early Learning Centre","category":"School","verified":true,"date":"2025-03-15"}'::jsonb),
  ('a2', '2025-03-20T00:00:00Z', '{"id":"a2","name":"Little Stars Nursery","category":"Nursery","verified":true,"date":"2025-03-20"}'::jsonb),
  ('a3', '2025-03-25T00:00:00Z', '{"id":"a3","name":"Kefilwe Modise","category":"Nanny","verified":true,"date":"2025-03-25"}'::jsonb),
  ('a4', '2025-03-28T00:00:00Z', '{"id":"a4","name":"Dr. Mpho Ramodupi","category":"Pediatric Clinic","verified":true,"date":"2025-03-28"}'::jsonb),
  ('a5', '2025-04-01T00:00:00Z', '{"id":"a5","name":"Naledi Kgomotso","category":"Tutor","verified":true,"date":"2025-04-01"}'::jsonb)
on conflict (id) do nothing;

alter table public.platform_users                   enable row level security;
alter table public.platform_sessions                enable row level security;
alter table public.platform_revoked_session_tokens  enable row level security;
alter table public.platform_account_tokens          enable row level security;
alter table public.platform_parent_profiles         enable row level security;
alter table public.platform_provider_profiles       enable row level security;
alter table public.platform_uploads                 enable row level security;
alter table public.platform_conversations           enable row level security;
alter table public.platform_pending_verifications   enable row level security;
alter table public.platform_approved_verifications  enable row level security;
alter table public.platform_counters                enable row level security;
