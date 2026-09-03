import {
  D1_MAX_BOUND_PARAMS,
  d1Batch,
  type D1Row,
  type D1Statement,
} from "@/lib/cloudflare-d1";
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

// Cloudflare D1 persistence driver for the platform store.
//
// Deliberately mirrors lib/platform-store-supabase.ts: read the whole store,
// let the callers in lib/platform-store.ts mutate it in memory, then write back
// only the rows that actually changed. Column names match the Postgres schema
// one-for-one so the two drivers stay comparable.
//
// Differences forced by SQLite:
//   - jsonb documents are TEXT, so they are JSON.stringify'd on write and
//     parsed on read.
//   - booleans are INTEGER 0/1.
//   - There is no row level security. See the note at the top of
//     d1/migrations/0001_platform_store.sql.

const REJECTED_COUNT_KEY = "rejected_count";
const EPOCH = new Date(0).toISOString();

interface TableSpec<T> {
  table: string;
  key: string;
  columns: string[];
  order: { column: string; ascending: boolean };
  keyOf(item: T): string;
  toRow(item: T, previous?: D1Row): D1Row;
  fromRow(row: D1Row): T;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isoOrUndefined(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function iso(value: unknown, fallback = EPOCH) {
  return isoOrUndefined(value) ?? fallback;
}

function carriedTimestamp(previous: D1Row | undefined, column: string) {
  return isoOrUndefined(previous?.[column]) ?? new Date().toISOString();
}

/** SQLite has no boolean type; the schema stores 0/1. */
function boolToInt(value: boolean | undefined) {
  return value ? 1 : 0;
}

function intToBool(value: unknown) {
  return value === 1 || value === true || value === "1";
}

function documentOf<T>(row: D1Row): T {
  const raw = row.data;
  if (typeof raw !== "string" || !raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Stable stringification for change detection. Unlike Postgres, SQLite stores
 * TEXT byte-for-byte, but the app builds documents with keys in varying order,
 * so rows are still compared with keys sorted and `undefined` dropped.
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

/** Documents are serialized once, in key-sorted form, so writes stay stable. */
function jsonColumn(value: unknown) {
  return JSON.stringify(sortKeysDeep(value));
}

const USERS: TableSpec<PlatformUser> = {
  table: "platform_users",
  key: "id",
  columns: [
    "id",
    "role",
    "name",
    "email",
    "phone",
    "location",
    "category",
    "password_hash",
    "email_verified_at",
    "stripe_customer_id",
    "created_at",
    "last_login_at",
  ],
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
    stripe_customer_id: user.stripeCustomerId ?? null,
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
    stripeCustomerId: optionalText(row.stripe_customer_id),
    createdAt: iso(row.created_at),
    lastLoginAt: isoOrUndefined(row.last_login_at),
  }),
};

const SESSIONS: TableSpec<PlatformSession> = {
  table: "platform_sessions",
  key: "token",
  columns: ["token", "user_id", "role", "created_at", "expires_at"],
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
  columns: ["token", "revoked_at"],
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
  columns: ["token", "user_id", "type", "created_at", "expires_at", "used_at"],
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
  columns: ["user_id", "data"],
  order: { column: "user_id", ascending: true },
  keyOf: (profile) => profile.userId,
  toRow: (profile) => ({ user_id: profile.userId, data: jsonColumn(profile) }),
  fromRow: (row) => ({
    ...documentOf<ParentProfileRecord>(row),
    userId: text(row.user_id),
  }),
};

const PROVIDER_PROFILES: TableSpec<ProviderProfileRecord> = {
  table: "platform_provider_profiles",
  key: "user_id",
  columns: ["user_id", "data"],
  order: { column: "user_id", ascending: true },
  keyOf: (profile) => profile.userId,
  toRow: (profile) => ({ user_id: profile.userId, data: jsonColumn(profile) }),
  fromRow: (row) => ({
    ...documentOf<ProviderProfileRecord>(row),
    userId: text(row.user_id),
  }),
};

const UPLOADS: TableSpec<PlatformUploadRecord> = {
  table: "platform_uploads",
  key: "id",
  columns: [
    "id",
    "user_id",
    "type",
    "document_key",
    "label",
    "file_name",
    "content_type",
    "size",
    "path",
    "created_at",
  ],
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
  columns: ["id", "created_at", "data"],
  order: { column: "created_at", ascending: false },
  keyOf: (conversation) => conversation.id,
  toRow: (conversation, previous) => ({
    id: conversation.id,
    created_at: carriedTimestamp(previous, "created_at"),
    data: jsonColumn(conversation),
  }),
  fromRow: (row) => ({
    ...documentOf<StoredConversation>(row),
    id: text(row.id),
  }),
};

const PENDING_VERIFICATIONS: TableSpec<PendingVerification> = {
  table: "platform_pending_verifications",
  key: "id",
  columns: ["id", "created_at", "data"],
  order: { column: "created_at", ascending: false },
  keyOf: (pending) => pending.id,
  toRow: (pending, previous) => ({
    id: pending.id,
    created_at: carriedTimestamp(previous, "created_at"),
    data: jsonColumn(pending),
  }),
  fromRow: (row) => ({
    ...documentOf<PendingVerification>(row),
    id: text(row.id),
  }),
};

const APPROVED_VERIFICATIONS: TableSpec<ApprovedVerification> = {
  table: "platform_approved_verifications",
  key: "id",
  columns: ["id", "created_at", "data"],
  order: { column: "created_at", ascending: false },
  keyOf: (approved) => approved.id,
  toRow: (approved, previous) => ({
    id: approved.id,
    created_at: carriedTimestamp(previous, "created_at"),
    data: jsonColumn(approved),
  }),
  fromRow: (row) => ({
    ...documentOf<ApprovedVerification>(row),
    id: text(row.id),
  }),
};

const SUBSCRIPTIONS: TableSpec<BillingSubscriptionRecord> = {
  table: "platform_subscriptions",
  key: "stripe_subscription_id",
  columns: [
    "stripe_subscription_id",
    "user_id",
    "plan_id",
    "status",
    "stripe_customer_id",
    "stripe_price_id",
    "amount",
    "currency",
    "current_period_end",
    "cancel_at_period_end",
    "started_at",
    "updated_at",
    "canceled_at",
  ],
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
    cancel_at_period_end: boolToInt(subscription.cancelAtPeriodEnd),
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
    cancelAtPeriodEnd: intToBool(row.cancel_at_period_end),
    startedAt: iso(row.started_at),
    updatedAt: iso(row.updated_at),
    canceledAt: isoOrUndefined(row.canceled_at),
  }),
};

const PAYMENTS: TableSpec<BillingPaymentRecord> = {
  table: "platform_payments",
  key: "id",
  columns: [
    "id",
    "user_id",
    "kind",
    "description",
    "amount",
    "currency",
    "status",
    "stripe_customer_id",
    "stripe_session_id",
    "stripe_invoice_id",
    "stripe_payment_intent_id",
    "package_id",
    "created_at",
  ],
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
  columns: ["event_id", "processed_at"],
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

export interface D1StoreSnapshot {
  /** table -> primary key -> the row as it was read. */
  rows: Map<string, Map<string, D1Row>>;
  /** table -> primary key -> canonical form, used to skip unchanged rows. */
  canonicalRows: Map<string, Map<string, string>>;
  rejectedCount: number;
}

function indexRows(spec: TableSpec<unknown>, rows: D1Row[]) {
  return new Map(rows.map((row) => [String(row[spec.key]), row]));
}

function keyByUserId<T extends { userId: string }>(profiles: T[]) {
  return Object.fromEntries(profiles.map((profile) => [profile.userId, profile]));
}

/**
 * Loads the whole store. `normalize` is the store's own normalizeStore, passed
 * in so this module never imports lib/platform-store.ts at runtime.
 */
export async function readD1Store(
  normalize: (store: Partial<PlatformStore>) => PlatformStore
): Promise<{ store: PlatformStore; snapshot: D1StoreSnapshot }> {
  const selects: D1Statement[] = TABLE_ORDER.map((spec) => ({
    sql: `select * from ${spec.table} order by ${spec.order.column} ${
      spec.order.ascending ? "asc" : "desc"
    }, ${spec.key} ${spec.order.ascending ? "asc" : "desc"}`,
  }));
  selects.push({
    sql: "select value from platform_counters where key = ?",
    params: [REJECTED_COUNT_KEY],
  });

  const results = await d1Batch(selects);
  const byTable = new Map<string, D1Row[]>(
    TABLE_ORDER.map((spec, index) => [spec.table, results[index] ?? []])
  );
  const rejectedCount = Number(results[TABLE_ORDER.length]?.[0]?.value) || 0;

  const rawRows = new Map<string, Map<string, D1Row>>(
    TABLE_ORDER.map((spec) => [spec.table, indexRows(spec, byTable.get(spec.table) ?? [])])
  );

  const rowsOf = (spec: TableSpec<unknown>) => byTable.get(spec.table) ?? [];

  const store = normalize({
    users: rowsOf(USERS).map(USERS.fromRow),
    sessions: rowsOf(SESSIONS).map(SESSIONS.fromRow),
    revokedSessionTokens: rowsOf(REVOKED_SESSION_TOKENS).map(REVOKED_SESSION_TOKENS.fromRow),
    accountTokens: rowsOf(ACCOUNT_TOKENS).map(ACCOUNT_TOKENS.fromRow),
    parentProfiles: keyByUserId(rowsOf(PARENT_PROFILES).map(PARENT_PROFILES.fromRow)),
    providerProfiles: keyByUserId(rowsOf(PROVIDER_PROFILES).map(PROVIDER_PROFILES.fromRow)),
    uploads: rowsOf(UPLOADS).map(UPLOADS.fromRow),
    conversations: rowsOf(CONVERSATIONS).map(CONVERSATIONS.fromRow),
    subscriptions: rowsOf(SUBSCRIPTIONS).map(SUBSCRIPTIONS.fromRow),
    payments: rowsOf(PAYMENTS).map(PAYMENTS.fromRow),
    processedStripeEvents: rowsOf(STRIPE_EVENTS).map(STRIPE_EVENTS.fromRow),
    verifications: {
      pendingProviders: rowsOf(PENDING_VERIFICATIONS).map(PENDING_VERIFICATIONS.fromRow),
      approvedProviders: rowsOf(APPROVED_VERIFICATIONS).map(APPROVED_VERIFICATIONS.fromRow),
      rejectedCount,
    },
  });

  // Snapshot after normalization so defaults filled in memory are not written
  // back as a change on every single request.
  return { store, snapshot: snapshotStore(store, rawRows, rejectedCount) };
}

function snapshotStore(
  store: PlatformStore,
  rawRows: Map<string, Map<string, D1Row>>,
  rejectedCount: number
): D1StoreSnapshot {
  const collections = collectionsOf(store);
  const canonicalRows = new Map<string, Map<string, string>>();

  for (const spec of TABLE_ORDER) {
    const previousRows = rawRows.get(spec.table) ?? new Map<string, D1Row>();
    const entries = new Map<string, string>();
    for (const item of collections.get(spec.table) ?? []) {
      const key = spec.keyOf(item);
      entries.set(key, canonical(spec.toRow(item, previousRows.get(key))));
    }
    canonicalRows.set(spec.table, entries);
  }

  return { rows: rawRows, canonicalRows, rejectedCount };
}

/**
 * Splits rows into groups that stay under D1's 100 bound-parameter ceiling.
 * A statement binds `columns.length` parameters per row, so a 13-column table
 * fits 7 rows per statement.
 */
function chunkRowsByParams(rows: D1Row[], columnCount: number) {
  const rowsPerStatement = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnCount));
  const chunks: D1Row[][] = [];
  for (let index = 0; index < rows.length; index += rowsPerStatement) {
    chunks.push(rows.slice(index, index + rowsPerStatement));
  }
  return chunks;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function upsertStatement(spec: TableSpec<unknown>, rows: D1Row[]): D1Statement {
  const placeholders = rows
    .map(() => `(${spec.columns.map(() => "?").join(", ")})`)
    .join(", ");
  const updates = spec.columns
    .filter((column) => column !== spec.key)
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  return {
    sql:
      `insert into ${spec.table} (${spec.columns.join(", ")}) values ${placeholders} ` +
      `on conflict(${spec.key}) do update set ${updates}`,
    params: rows.flatMap((row) => spec.columns.map((column) => row[column] ?? null)),
  };
}

/** Writes only the rows that the updater actually changed, added, or removed. */
export async function writeD1Store(store: PlatformStore, snapshot: D1StoreSnapshot) {
  const collections = collectionsOf(store);
  const plans = TABLE_ORDER.map((spec) => {
    const previousRows = snapshot.rows.get(spec.table) ?? new Map<string, D1Row>();
    const previousCanonical = snapshot.canonicalRows.get(spec.table) ?? new Map<string, string>();
    const upserts: D1Row[] = [];
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

  const statements: D1Statement[] = [];

  for (const { spec, upserts } of plans) {
    for (const rows of chunkRowsByParams(upserts, spec.columns.length)) {
      statements.push(upsertStatement(spec, rows));
    }
  }

  for (const { spec, removals } of [...plans].reverse()) {
    for (const keys of chunk(removals, D1_MAX_BOUND_PARAMS)) {
      statements.push({
        sql: `delete from ${spec.table} where ${spec.key} in (${keys.map(() => "?").join(", ")})`,
        params: keys,
      });
    }
  }

  if (store.verifications.rejectedCount !== snapshot.rejectedCount) {
    statements.push({
      sql: "insert into platform_counters (key, value) values (?, ?) on conflict(key) do update set value = excluded.value",
      params: [REJECTED_COUNT_KEY, store.verifications.rejectedCount],
    });
  }

  if (statements.length > 0) await d1Batch(statements);
}
