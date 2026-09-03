-- Kidcellence platform store — Cloudflare D1 (SQLite) schema.
--
-- Port of supabase/migrations/0001_platform_store.sql. The table and column
-- names are identical so lib/platform-store-d1.ts and
-- lib/platform-store-supabase.ts can share the same row shapes.
--
-- Type mapping from the Postgres original:
--   text/timestamptz -> TEXT. The app stores and compares plain ISO 8601
--                       strings, which sort correctly as text, so no conversion
--                       is needed on read.
--   jsonb            -> TEXT holding serialized JSON. Indexed with
--                       json_extract() where the Postgres version used ->>.
--   boolean          -> INTEGER 0/1.
--   bigint           -> INTEGER.
--
-- SECURITY NOTE — this schema has no row level security.
--
-- The Postgres original enabled RLS with no policies on every table, so a
-- leaked publishable key could read nothing. SQLite and D1 have no equivalent
-- mechanism. Every protection here rests on the Cloudflare API token (or the
-- Worker binding) never reaching the browser. That matters more than usual for
-- this schema: platform_uploads references certified ID documents and police
-- clearances, and platform_parent_profiles holds children's names and dates of
-- birth. Treat the D1 credentials as the only thing standing in front of that.

create table if not exists platform_users (
  id                TEXT primary key,
  role              TEXT not null check (role in ('parent', 'provider', 'admin')),
  name              TEXT not null default '',
  email             TEXT not null unique,
  phone             TEXT,
  location          TEXT,
  category          TEXT,
  password_hash     TEXT not null,
  email_verified_at TEXT,
  created_at        TEXT not null,
  last_login_at     TEXT
);

create index if not exists platform_users_created_at_idx
  on platform_users (created_at desc);

create table if not exists platform_sessions (
  token      TEXT primary key,
  user_id    TEXT not null references platform_users (id) on delete cascade,
  role       TEXT not null,
  created_at TEXT not null,
  expires_at TEXT not null
);

create index if not exists platform_sessions_user_id_idx
  on platform_sessions (user_id);
create index if not exists platform_sessions_expires_at_idx
  on platform_sessions (expires_at);

-- Sessions invalidated before their natural expiry (logout, password reset).
create table if not exists platform_revoked_session_tokens (
  token      TEXT primary key,
  revoked_at TEXT not null
);

create table if not exists platform_account_tokens (
  token      TEXT primary key,
  user_id    TEXT not null references platform_users (id) on delete cascade,
  type       TEXT not null check (type in ('email-verification', 'password-reset')),
  created_at TEXT not null,
  expires_at TEXT not null,
  used_at    TEXT
);

create index if not exists platform_account_tokens_user_id_idx
  on platform_account_tokens (user_id, type);

create table if not exists platform_parent_profiles (
  user_id TEXT primary key references platform_users (id) on delete cascade,
  data    TEXT not null default '{}'
);

create table if not exists platform_provider_profiles (
  user_id TEXT primary key references platform_users (id) on delete cascade,
  data    TEXT not null default '{}'
);

-- Published provider profiles drive the public listings.
create index if not exists platform_provider_profiles_published_idx
  on platform_provider_profiles (json_extract(data, '$.published'));

create table if not exists platform_uploads (
  id           TEXT primary key,
  user_id      TEXT not null references platform_users (id) on delete cascade,
  type         TEXT not null check (type in ('document', 'gallery', 'profile-image', 'cover-image')),
  document_key TEXT,
  label        TEXT not null default '',
  file_name    TEXT not null default '',
  content_type TEXT not null default '',
  size         INTEGER not null default 0,
  path         TEXT not null,
  created_at   TEXT not null
);

create index if not exists platform_uploads_user_id_idx
  on platform_uploads (user_id, type);

create table if not exists platform_conversations (
  id         TEXT primary key,
  created_at TEXT not null,
  data       TEXT not null default '{}'
);

create index if not exists platform_conversations_parent_idx
  on platform_conversations (json_extract(data, '$.parentUserId'));
create index if not exists platform_conversations_provider_idx
  on platform_conversations (json_extract(data, '$.providerUserId'));

create table if not exists platform_pending_verifications (
  id         TEXT primary key,
  created_at TEXT not null,
  data       TEXT not null default '{}'
);

create table if not exists platform_approved_verifications (
  id         TEXT primary key,
  created_at TEXT not null,
  data       TEXT not null default '{}'
);

-- Scalar counters that have no natural row of their own (rejected_count).
create table if not exists platform_counters (
  key   TEXT primary key,
  value INTEGER not null default 0
);

insert into platform_counters (key, value)
values ('rejected_count', 0)
on conflict (key) do nothing;

-- Seed the baseline approved verifications that the JSON store shipped in
-- createInitialStore(). providerIsApproved() matches these by display name, so
-- omitting them would silently un-verify the bundled demo providers.
insert into platform_approved_verifications (id, created_at, data)
values
  ('a1', '2025-03-15T00:00:00.000Z', '{"id":"a1","name":"Sunshine Early Learning Centre","category":"School","verified":true,"date":"2025-03-15"}'),
  ('a2', '2025-03-20T00:00:00.000Z', '{"id":"a2","name":"Little Stars Nursery","category":"Nursery","verified":true,"date":"2025-03-20"}'),
  ('a3', '2025-03-25T00:00:00.000Z', '{"id":"a3","name":"Kefilwe Modise","category":"Nanny","verified":true,"date":"2025-03-25"}'),
  ('a4', '2025-03-28T00:00:00.000Z', '{"id":"a4","name":"Dr. Mpho Ramodupi","category":"Pediatric Clinic","verified":true,"date":"2025-03-28"}'),
  ('a5', '2025-04-01T00:00:00.000Z', '{"id":"a5","name":"Naledi Kgomotso","category":"Tutor","verified":true,"date":"2025-04-01"}')
on conflict (id) do nothing;
