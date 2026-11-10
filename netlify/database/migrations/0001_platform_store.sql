-- Kidcellence platform store: relational schema.
--
-- Applied automatically by Netlify Database to deploy-preview branches and,
-- before publish, to production. Locally the tests apply it themselves.
-- Every statement is idempotent (IF NOT EXISTS) so a partially applied run can
-- be re-applied safely.
--
-- Design (see docs/persistence-architecture.md):
--   * Each row keeps the complete application record in `data` (lossless).
--   * Identity, lookup and integrity columns are GENERATED from `data` by
--     Postgres, so they can never drift from the record.
--   * `seq` preserves the order the application keeps its lists in.
--   * Foreign keys are DEFERRABLE INITIALLY DEFERRED: a transaction may write
--     a parent and its children in any order; integrity is checked at COMMIT.
--   * All application writers serialise on one transaction-scoped advisory
--     lock (lib/store-postgres.ts), so read-modify-write cannot lose updates.

CREATE TABLE IF NOT EXISTS platform_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY CHECK (id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  email_normalized text GENERATED ALWAYS AS (lower(btrim(data ->> 'email'))) STORED,
  role text GENERATED ALWAYS AS (data ->> 'role') STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_id_matches_data CHECK (data ->> 'id' = id),
  CONSTRAINT users_email_present CHECK (email_normalized IS NOT NULL AND email_normalized <> ''),
  CONSTRAINT users_role_valid CHECK (role IN ('parent', 'provider', 'admin'))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_key ON users (email_normalized);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY CHECK (token <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  user_id text GENERATED ALWAYS AS (data ->> 'userId') STORED,
  expires_at_text text GENERATED ALWAYS AS (data ->> 'expiresAt') STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_token_matches_data CHECK (data ->> 'token' = token),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS revoked_session_tokens (
  token text PRIMARY KEY CHECK (token <> ''),
  seq bigserial NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS removed_users (
  user_id text PRIMARY KEY CHECK (user_id <> ''),
  seq bigserial NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_tokens (
  token text PRIMARY KEY CHECK (token <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  user_id text GENERATED ALWAYS AS (data ->> 'userId') STORED,
  type text GENERATED ALWAYS AS (data ->> 'type') STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_tokens_token_matches_data CHECK (data ->> 'token' = token),
  CONSTRAINT account_tokens_type_valid CHECK (type IN ('email-verification', 'password-reset')),
  CONSTRAINT account_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS account_tokens_user_id_idx ON account_tokens (user_id);

-- Profiles are keyed by user id but deliberately have no foreign key: the app
-- supports profile-only provider listings (see accountProvidersFromStore).
CREATE TABLE IF NOT EXISTS parent_profiles (
  user_id text PRIMARY KEY CHECK (user_id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_profiles (
  user_id text PRIMARY KEY CHECK (user_id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  published text GENERATED ALWAYS AS (data ->> 'published') STORED,
  verification_status text GENERATED ALWAYS AS (data ->> 'verificationStatus') STORED,
  payment_status text GENERATED ALWAYS AS (data ->> 'verificationPaymentStatus') STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_profiles_verification_status_valid CHECK (
    verification_status IS NULL
    OR verification_status IN ('not_submitted', 'pending', 'approved', 'rejected')
  ),
  CONSTRAINT provider_profiles_payment_status_valid CHECK (
    payment_status IS NULL OR payment_status IN ('unpaid', 'paid')
  )
);
CREATE INDEX IF NOT EXISTS provider_profiles_published_idx ON provider_profiles (published);

CREATE TABLE IF NOT EXISTS uploads (
  id text PRIMARY KEY CHECK (id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  user_id text GENERATED ALWAYS AS (data ->> 'userId') STORED,
  type text GENERATED ALWAYS AS (data ->> 'type') STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uploads_id_matches_data CHECK (data ->> 'id' = id),
  CONSTRAINT uploads_type_valid CHECK (type IN ('document', 'gallery', 'profile-image', 'cover-image'))
);
CREATE INDEX IF NOT EXISTS uploads_user_id_idx ON uploads (user_id);

-- One conversation per parent and provider listing: appendConversationMessage
-- reuses an existing conversation rather than opening a second one.
CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY CHECK (id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND NOT (data ? 'messages')),
  parent_user_id text GENERATED ALWAYS AS (data ->> 'parentUserId') STORED,
  provider_id text GENERATED ALWAYS AS (data ->> 'providerId') STORED,
  provider_user_id text GENERATED ALWAYS AS (data ->> 'providerUserId') STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_id_matches_data CHECK (data ->> 'id' = id),
  CONSTRAINT conversations_parties_present CHECK (parent_user_id IS NOT NULL AND provider_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_parent_provider_key
  ON conversations (parent_user_id, provider_id);
CREATE INDEX IF NOT EXISTS conversations_provider_user_id_idx ON conversations (provider_user_id);

CREATE TABLE IF NOT EXISTS messages (
  conversation_id text NOT NULL,
  id text NOT NULL CHECK (id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  sender_id text GENERATED ALWAYS AS (data ->> 'senderId') STORED,
  client_message_id text GENERATED ALWAYS AS (data ->> 'clientMessageId') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, id),
  CONSTRAINT messages_id_matches_data CHECK (data ->> 'id' = id),
  CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations (id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
-- A retried send carries the same client id and must not create a second message.
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_key
  ON messages (conversation_id, sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_conversation_seq_idx ON messages (conversation_id, seq);

CREATE TABLE IF NOT EXISTS pending_verifications (
  id text PRIMARY KEY CHECK (id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  user_id text GENERATED ALWAYS AS (data ->> 'userId') STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_verifications_user_present CHECK (user_id IS NOT NULL AND user_id <> '')
);
CREATE INDEX IF NOT EXISTS pending_verifications_user_id_idx ON pending_verifications (user_id);

CREATE TABLE IF NOT EXISTS approved_verifications (
  id text PRIMARY KEY CHECK (id <> ''),
  seq bigserial NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  user_id text GENERATED ALWAYS AS (data ->> 'userId') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approved_verifications_user_id_idx ON approved_verifications (user_id);

-- Analytics are updated under row locks, independently of the store lock, so
-- page-view traffic never queues behind account or message writes.
CREATE TABLE IF NOT EXISTS platform_analytics (
  id smallint PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_analytics (
  user_id text PRIMARY KEY CHECK (user_id <> ''),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
