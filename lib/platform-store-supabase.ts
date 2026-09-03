import { supabaseAdminClient } from "@/lib/supabase";
import type { ApprovedVerification, PendingVerification } from "@/lib/platform-service";
import type {
  AccountTokenRecord,
  BillingPaymentRecord,
  BillingSubscriptionRecord,
  BillingSubscriptionStatus,
  ParentProfileRecord,
  PlatformSession,
  PlatformStore,
  PlatformUploadRecord,
  PlatformUser,
  ProviderProfileRecord,
  StoredConversation,
  UserRole,
} from "@/lib/platform-store";
import type { BillingPlanId } from "@/lib/billing-plans";

// Supabase persistence driver for the platform store.
//
// The store is read as a whole, mutated in memory by the callers in
// lib/platform-store.ts, and written back as a per-row diff. That keeps every
// existing store function working unchanged while giving each mutation a
// targeted write: two requests touching different rows no longer overwrite each
// other the way a whole-file JSON rewrite did. Concurrent writes to the *same*
// row still last-write-wins, exactly as before.

type Row = Record<string, unknown>;

const REJECTED_COUNT_KEY = "rejected_count";
const MISSING_SCHEMA_HINT =
  "The platform tables are missing. Apply every file in supabase/migrations/ to the project (Supabase SQL Editor, or `npx supabase db push`), or set PLATFORM_STORE_DRIVER=json to use the local JSON store.";
const SELECT_PAGE_SIZE = 1000;
const UPSERT_CHUNK_SIZE = 500;
const DELETE_CHUNK_SIZE = 200;
const EPOCH = new Date(0).toISOString();

interface TableSpec<T> {
  table: string;
  key: string;
  /** Newest-first ordering matches the unshift/prepend behaviour of the JSON store. */
  order: { column: string; ascending: boolean };
  keyOf(item: T): string;
  /** `previous` carries forward server-managed columns so rows are not churned. */
  toRow(item: T, previous?: Row): Row;
  fromRow(row: Row): T;
}

/** `42P01` is Postgres "undefined table"; `PGRST205` is the PostgREST cache equivalent. */
function supabaseError(
  action: string,
  table: string,
  error: { message: string; code?: string }
) {
  const schemaMissing = error.code === "42P01" || error.code === "PGRST205";
  return new Error(
    `Failed to ${action} ${table} in Supabase: ${error.message}${
      schemaMissing ? `\n${MISSING_SCHEMA_HINT}` : ""
    }`
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Postgres returns `+00:00` offsets; the app compares plain ISO strings. */
function isoOrUndefined(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function iso(value: unknown, fallback = EPOCH) {
  return isoOrUndefined(value) ?? fallback;
}

function carriedTimestamp(previous: Row | undefined, column: string) {
  return isoOrUndefined(previous?.[column]) ?? new Date().toISOString();
}

function documentOf<T>(row: Row): T {
  return (row.data && typeof row.data === "object" ? row.data : {}) as T;
}

/**
 * Stable stringification. Postgres reorders `jsonb` keys on storage, so rows are
 * compared with keys sorted and `undefined` dropped.
 */
function canonical(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, sortKeysDeep(source[key])])
  );
}

const USERS: TableSpec<PlatformUser> = {
  table: "platform_users",
  key: "id",
  order: { column: "created_at", ascending: false },
  keyOf: (user) => user.id,
  toRow: (user) => ({
    id: user.id,
    role: user.role,
    name: user.name ?? "",
    email: user.email,
    phone: user.phone ?? null,
    location: user.location ?? null,
    category: user.category ?? null,
    password_hash: user.passwordHash,
    email_verified_at: user.emailVerifiedAt ?? null,
    created_at: user.createdAt,
    last_login_at: user.lastLoginAt ?? null,
  }),
  fromRow: (row) => ({
    id: text(row.id),
    role: text(row.role) as UserRole,
    name: text(row.name),
    email: text(row.email),
    phone: optionalText(row.phone),
    location: optionalText(row.location),
    category: optionalText(row.category),
    passwordHash: text(row.password_hash),
    emailVerifiedAt: isoOrUndefined(row.email_verified_at),
    createdAt: iso(row.created_at),
    lastLoginAt: isoOrUndefined(row.last_login_at),
  }),
};

const SESSIONS: TableSpec<PlatformSession> = {
  table: "platform_sessions",
  key: "token",
  order: { column: "created_at", ascending: true },
  keyOf: (session) => session.token,
  toRow: (session) => ({
    token: session.token,
    user_id: session.userId,
    role: session.role,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
  }),
  fromRow: (row) => ({
    token: text(row.token),
    userId: text(row.user_id),
    role: text(row.role) as UserRole,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
  }),
};

const REVOKED_SESSION_TOKENS: TableSpec<string> = {
  table: "platform_revoked_session_tokens",
  key: "token",
  order: { column: "revoked_at", ascending: true },
  keyOf: (token) => token,
  toRow: (token, previous) => ({
    token,
    revoked_at: carriedTimestamp(previous, "revoked_at"),
  }),
  fromRow: (row) => text(row.token),
};

const ACCOUNT_TOKENS: TableSpec<AccountTokenRecord> = {
  table: "platform_account_tokens",
  key: "token",
  order: { column: "created_at", ascending: true },
  keyOf: (accountToken) => accountToken.token,
  toRow: (accountToken) => ({
    token: accountToken.token,
    user_id: accountToken.userId,
    type: accountToken.type,
    created_at: accountToken.createdAt,
    expires_at: accountToken.expiresAt,
    used_at: accountToken.usedAt ?? null,
  }),
  fromRow: (row) => ({
    token: text(row.token),
    userId: text(row.user_id),
    type: text(row.type) as AccountTokenRecord["type"],
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    usedAt: isoOrUndefined(row.used_at),
  }),
};

const PARENT_PROFILES: TableSpec<ParentProfileRecord> = {
  table: "platform_parent_profiles",
  key: "user_id",
  order: { column: "user_id", ascending: true },
  keyOf: (profile) => profile.userId,
  toRow: (profile) => ({ user_id: profile.userId, data: profile }),
  fromRow: (row) => ({
    ...documentOf<ParentProfileRecord>(row),
    userId: text(row.user_id),
  }),
};

const PROVIDER_PROFILES: TableSpec<ProviderProfileRecord> = {
  table: "platform_provider_profiles",
  key: "user_id",
  order: { column: "user_id", ascending: true },
  keyOf: (profile) => profile.userId,
  toRow: (profile) => ({ user_id: profile.userId, data: profile }),
  fromRow: (row) => ({
    ...documentOf<ProviderProfileRecord>(row),
    userId: text(row.user_id),
  }),
};

const UPLOADS: TableSpec<PlatformUploadRecord> = {
  table: "platform_uploads",
  key: "id",
  order: { column: "created_at", ascending: false },
  keyOf: (upload) => upload.id,
  toRow: (upload) => ({
    id: upload.id,
    user_id: upload.userId,
    type: upload.type,
    document_key: upload.documentKey ?? null,
    label: upload.label ?? "",
    file_name: upload.fileName ?? "",
    content_type: upload.contentType ?? "",
    size: upload.size ?? 0,
    path: upload.path,
    created_at: upload.createdAt,
  }),
  fromRow: (row) => ({
    id: text(row.id),
    userId: text(row.user_id),
    type: text(row.type) as PlatformUploadRecord["type"],
    documentKey: optionalText(row.document_key),
    label: text(row.label),
    fileName: text(row.file_name),
    contentType: text(row.content_type),
    size: Number(row.size) || 0,
    path: text(row.path),
    createdAt: iso(row.created_at),
  }),
};

const CONVERSATIONS: TableSpec<StoredConversation> = {
  table: "platform_conversations",
  key: "id",
  order: { column: "created_at", ascending: false },
  keyOf: (conversation) => conversation.id,
  toRow: (conversation, previous) => ({
    id: conversation.id,
    created_at: carriedTimestamp(previous, "created_at"),
    data: conversation,
  }),
  fromRow: (row) => ({
    ...documentOf<StoredConversation>(row),
    id: text(row.id),
  }),
};

const PENDING_VERIFICATIONS: TableSpec<PendingVerification> = {
  table: "platform_pending_verifications",
  key: "id",
  order: { column: "created_at", ascending: false },
  keyOf: (pending) => pending.id,
  toRow: (pending, previous) => ({
    id: pending.id,
    created_at: carriedTimestamp(previous, "created_at"),
    data: pending,
  }),
  fromRow: (row) => ({
    ...documentOf<PendingVerification>(row),
    id: text(row.id),
  }),
};

const APPROVED_VERIFICATIONS: TableSpec<ApprovedVerification> = {
  table: "platform_approved_verifications",
  key: "id",
  order: { column: "created_at", ascending: false },
  keyOf: (approved) => approved.id,
  toRow: (approved, previous) => ({
    id: approved.id,
    created_at: carriedTimestamp(previous, "created_at"),
    data: approved,
  }),
  fromRow: (row) => ({
    ...documentOf<ApprovedVerification>(row),
    id: text(row.id),
  }),
};

const SUBSCRIPTIONS: TableSpec<BillingSubscriptionRecord> = {
  table: "platform_subscriptions",
  key: "stripe_subscription_id",
  order: { column: "updated_at", ascending: false },
  keyOf: (subscription) => subscription.stripeSubscriptionId,
  toRow: (subscription) => ({
    stripe_subscription_id: subscription.stripeSubscriptionId,
    user_id: subscription.userId,
    plan_id: subscription.planId,
    status: subscription.status,
    stripe_customer_id: subscription.stripeCustomerId,
    stripe_price_id: subscription.stripePriceId ?? null,
    amount: subscription.amount,
    currency: subscription.currency,
    current_period_end: subscription.currentPeriodEnd ?? null,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    started_at: subscription.startedAt,
    updated_at: subscription.updatedAt,
    canceled_at: subscription.canceledAt ?? null,
  }),
  fromRow: (row) => ({
    stripeSubscriptionId: text(row.stripe_subscription_id),
    userId: text(row.user_id),
    planId: text(row.plan_id) as BillingPlanId,
    status: text(row.status) as BillingSubscriptionStatus,
    stripeCustomerId: text(row.stripe_customer_id),
    stripePriceId: optionalText(row.stripe_price_id),
    amount: Number(row.amount) || 0,
    currency: text(row.currency) || "BWP",
    currentPeriodEnd: isoOrUndefined(row.current_period_end),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    startedAt: iso(row.started_at),
    updatedAt: iso(row.updated_at),
    canceledAt: isoOrUndefined(row.canceled_at),
  }),
};

const PAYMENTS: TableSpec<BillingPaymentRecord> = {
  table: "platform_payments",
  key: "id",
  order: { column: "created_at", ascending: false },
  keyOf: (payment) => payment.id,
  toRow: (payment) => ({
    id: payment.id,
    user_id: payment.userId,
    kind: payment.kind,
    description: payment.description ?? "",
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    stripe_customer_id: payment.stripeCustomerId ?? null,
    stripe_session_id: payment.stripeSessionId ?? null,
    stripe_invoice_id: payment.stripeInvoiceId ?? null,
    stripe_payment_intent_id: payment.stripePaymentIntentId ?? null,
    package_id: payment.packageId ?? null,
    created_at: payment.createdAt,
  }),
  fromRow: (row) => ({
    id: text(row.id),
    userId: text(row.user_id),
    kind: text(row.kind) as BillingPaymentRecord["kind"],
    description: text(row.description),
    amount: Number(row.amount) || 0,
    currency: text(row.currency) || "BWP",
    status: text(row.status) as BillingPaymentRecord["status"],
    stripeCustomerId: optionalText(row.stripe_customer_id),
    stripeSessionId: optionalText(row.stripe_session_id),
    stripeInvoiceId: optionalText(row.stripe_invoice_id),
    stripePaymentIntentId: optionalText(row.stripe_payment_intent_id),
    packageId: optionalText(row.package_id),
    createdAt: iso(row.created_at),
  }),
};

const STRIPE_EVENTS: TableSpec<string> = {
  table: "platform_stripe_events",
  key: "event_id",
  order: { column: "processed_at", ascending: true },
  keyOf: (eventId) => eventId,
  toRow: (eventId, previous) => ({
    event_id: eventId,
    processed_at: carriedTimestamp(previous, "processed_at"),
  }),
  fromRow: (row) => text(row.event_id),
};

/**
 * Parent tables first. Upserts run in this order so foreign keys resolve;
 * deletes run in reverse so children are removed before their user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLE_ORDER: TableSpec<any>[] = [
  USERS,
  SESSIONS,
  REVOKED_SESSION_TOKENS,
  ACCOUNT_TOKENS,
  PARENT_PROFILES,
  PROVIDER_PROFILES,
  UPLOADS,
  CONVERSATIONS,
  PENDING_VERIFICATIONS,
  APPROVED_VERIFICATIONS,
  SUBSCRIPTIONS,
  PAYMENTS,
  STRIPE_EVENTS,
];

function collectionsOf(store: PlatformStore) {
  return new Map<string, unknown[]>([
    [USERS.table, store.users],
    [SESSIONS.table, store.sessions],
    [REVOKED_SESSION_TOKENS.table, store.revokedSessionTokens],
    [ACCOUNT_TOKENS.table, store.accountTokens],
    [PARENT_PROFILES.table, Object.values(store.parentProfiles)],
    [PROVIDER_PROFILES.table, Object.values(store.providerProfiles)],
    [UPLOADS.table, store.uploads],
    [CONVERSATIONS.table, store.conversations],
    [PENDING_VERIFICATIONS.table, store.verifications.pendingProviders],
    [APPROVED_VERIFICATIONS.table, store.verifications.approvedProviders],
    [SUBSCRIPTIONS.table, store.subscriptions],
    [PAYMENTS.table, store.payments],
    [STRIPE_EVENTS.table, store.processedStripeEvents],
  ]);
}

export interface SupabaseStoreSnapshot {
  /** table -> primary key -> the row as it was read. */
  rows: Map<string, Map<string, Row>>;
  /** table -> primary key -> canonical form, used to skip unchanged rows. */
  canonicalRows: Map<string, Map<string, string>>;
  rejectedCount: number;
}

async function selectAll(spec: TableSpec<unknown>) {
  const client = supabaseAdminClient();
  const rows: Row[] = [];

  for (let offset = 0; ; offset += SELECT_PAGE_SIZE) {
    const { data, error } = await client
      .from(spec.table)
      .select("*")
      .order(spec.order.column, { ascending: spec.order.ascending })
      .order(spec.key, { ascending: spec.order.ascending })
      .range(offset, offset + SELECT_PAGE_SIZE - 1);

    if (error) throw supabaseError("read", spec.table, error);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < SELECT_PAGE_SIZE) return rows;
  }
}

async function readRejectedCount() {
  const client = supabaseAdminClient();
  const { data, error } = await client
    .from("platform_counters")
    .select("value")
    .eq("key", REJECTED_COUNT_KEY)
    .maybeSingle();

  if (error) throw supabaseError("read", "platform_counters", error);
  return Number(data?.value) || 0;
}

/**
 * Loads the whole store. `normalize` is the store's own normalizeStore, passed
 * in so this module never imports lib/platform-store.ts at runtime.
 */
export async function readSupabaseStore(
  normalize: (store: Partial<PlatformStore>) => PlatformStore
): Promise<{ store: PlatformStore; snapshot: SupabaseStoreSnapshot }> {
  const [
    users,
    sessions,
    revokedSessionTokens,
    accountTokens,
    parentProfiles,
    providerProfiles,
    uploads,
    conversations,
    pendingProviders,
    approvedProviders,
    subscriptions,
    payments,
    processedStripeEvents,
    rejectedCount,
  ] = await Promise.all([
    selectAll(USERS),
    selectAll(SESSIONS),
    selectAll(REVOKED_SESSION_TOKENS),
    selectAll(ACCOUNT_TOKENS),
    selectAll(PARENT_PROFILES),
    selectAll(PROVIDER_PROFILES),
    selectAll(UPLOADS),
    selectAll(CONVERSATIONS),
    selectAll(PENDING_VERIFICATIONS),
    selectAll(APPROVED_VERIFICATIONS),
    selectAll(SUBSCRIPTIONS),
    selectAll(PAYMENTS),
    selectAll(STRIPE_EVENTS),
    readRejectedCount(),
  ]);

  const rawRows = new Map<string, Map<string, Row>>([
    [USERS.table, indexRows(USERS, users)],
    [SESSIONS.table, indexRows(SESSIONS, sessions)],
    [REVOKED_SESSION_TOKENS.table, indexRows(REVOKED_SESSION_TOKENS, revokedSessionTokens)],
    [ACCOUNT_TOKENS.table, indexRows(ACCOUNT_TOKENS, accountTokens)],
    [PARENT_PROFILES.table, indexRows(PARENT_PROFILES, parentProfiles)],
    [PROVIDER_PROFILES.table, indexRows(PROVIDER_PROFILES, providerProfiles)],
    [UPLOADS.table, indexRows(UPLOADS, uploads)],
    [CONVERSATIONS.table, indexRows(CONVERSATIONS, conversations)],
    [PENDING_VERIFICATIONS.table, indexRows(PENDING_VERIFICATIONS, pendingProviders)],
    [APPROVED_VERIFICATIONS.table, indexRows(APPROVED_VERIFICATIONS, approvedProviders)],
    [SUBSCRIPTIONS.table, indexRows(SUBSCRIPTIONS, subscriptions)],
    [PAYMENTS.table, indexRows(PAYMENTS, payments)],
    [STRIPE_EVENTS.table, indexRows(STRIPE_EVENTS, processedStripeEvents)],
  ]);

  const store = normalize({
    users: users.map(USERS.fromRow),
    sessions: sessions.map(SESSIONS.fromRow),
    revokedSessionTokens: revokedSessionTokens.map(REVOKED_SESSION_TOKENS.fromRow),
    accountTokens: accountTokens.map(ACCOUNT_TOKENS.fromRow),
    parentProfiles: keyByUserId(parentProfiles.map(PARENT_PROFILES.fromRow)),
    providerProfiles: keyByUserId(providerProfiles.map(PROVIDER_PROFILES.fromRow)),
    uploads: uploads.map(UPLOADS.fromRow),
    conversations: conversations.map(CONVERSATIONS.fromRow),
    subscriptions: subscriptions.map(SUBSCRIPTIONS.fromRow),
    payments: payments.map(PAYMENTS.fromRow),
    processedStripeEvents: processedStripeEvents.map(STRIPE_EVENTS.fromRow),
    verifications: {
      pendingProviders: pendingProviders.map(PENDING_VERIFICATIONS.fromRow),
      approvedProviders: approvedProviders.map(APPROVED_VERIFICATIONS.fromRow),
      rejectedCount,
    },
  });

  // Snapshot after normalization so defaults filled in memory are not written
  // back as a change on every single request.
  return { store, snapshot: snapshotStore(store, rawRows, rejectedCount) };
}

function indexRows(spec: TableSpec<unknown>, rows: Row[]) {
  return new Map(rows.map((row) => [String(row[spec.key]), row]));
}

function keyByUserId<T extends { userId: string }>(profiles: T[]) {
  return Object.fromEntries(profiles.map((profile) => [profile.userId, profile]));
}

function snapshotStore(
  store: PlatformStore,
  rawRows: Map<string, Map<string, Row>>,
  rejectedCount: number
): SupabaseStoreSnapshot {
  const collections = collectionsOf(store);
  const canonicalRows = new Map<string, Map<string, string>>();

  for (const spec of TABLE_ORDER) {
    const previousRows = rawRows.get(spec.table) ?? new Map<string, Row>();
    const entries = new Map<string, string>();
    for (const item of collections.get(spec.table) ?? []) {
      const key = spec.keyOf(item);
      entries.set(key, canonical(spec.toRow(item, previousRows.get(key))));
    }
    canonicalRows.set(spec.table, entries);
  }

  return { rows: rawRows, canonicalRows, rejectedCount };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Writes only the rows that the updater actually changed, added, or removed. */
export async function writeSupabaseStore(store: PlatformStore, snapshot: SupabaseStoreSnapshot) {
  const client = supabaseAdminClient();
  const collections = collectionsOf(store);
  const plans = TABLE_ORDER.map((spec) => {
    const previousRows = snapshot.rows.get(spec.table) ?? new Map<string, Row>();
    const previousCanonical = snapshot.canonicalRows.get(spec.table) ?? new Map<string, string>();
    const upserts: Row[] = [];
    const keptKeys = new Set<string>();

    for (const item of collections.get(spec.table) ?? []) {
      const key = spec.keyOf(item);
      if (keptKeys.has(key)) continue;
      keptKeys.add(key);
      const row = spec.toRow(item, previousRows.get(key));
      if (previousCanonical.get(key) !== canonical(row)) upserts.push(row);
    }

    const removals = [...previousRows.keys()].filter((key) => !keptKeys.has(key));
    return { spec, upserts, removals };
  });

  for (const { spec, upserts } of plans) {
    for (const rows of chunk(upserts, UPSERT_CHUNK_SIZE)) {
      const { error } = await client.from(spec.table).upsert(rows, { onConflict: spec.key });
      if (error) throw supabaseError("write", spec.table, error);
    }
  }

  for (const { spec, removals } of [...plans].reverse()) {
    for (const keys of chunk(removals, DELETE_CHUNK_SIZE)) {
      const { error } = await client.from(spec.table).delete().in(spec.key, keys);
      if (error) throw supabaseError("delete from", spec.table, error);
    }
  }

  if (store.verifications.rejectedCount !== snapshot.rejectedCount) {
    const { error } = await client
      .from("platform_counters")
      .upsert(
        { key: REJECTED_COUNT_KEY, value: store.verifications.rejectedCount },
        { onConflict: "key" }
      );
    if (error) throw supabaseError("write", "platform_counters", error);
  }
}
