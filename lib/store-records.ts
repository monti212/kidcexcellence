/**
 * Pure mapping between the platform store object (the shape the app has always
 * used) and the relational tables in netlify/database/migrations.
 *
 * No imports, no I/O: the app's Postgres driver, the production import tool and
 * the tests all load this file directly, so they cannot disagree about how a
 * record maps to a row.
 *
 * Every row keeps the complete original record in a JSONB `data` column, so the
 * mapping is lossless; the indexed and constrained columns are generated from
 * `data` by the database itself and can never drift from it.
 */

export type JsonObject = Record<string, unknown>;

/** Mirrors LEGACY_DEMO_APPROVED_VERIFICATION_IDS in lib/platform-store.ts. */
export const LEGACY_DEMO_APPROVED_VERIFICATION_IDS = ["a1", "a2", "a3", "a4", "a5"];

export type TableName =
  | "users"
  | "sessions"
  | "revoked_session_tokens"
  | "removed_users"
  | "account_tokens"
  | "parent_profiles"
  | "provider_profiles"
  | "uploads"
  | "conversations"
  | "messages"
  | "pending_verifications"
  | "approved_verifications";

export interface TableSpec {
  table: TableName;
  /** Primary-key columns, in order. */
  keyColumns: string[];
  /** Key-only tables (string lists) have no `data` column. */
  keyOnly?: boolean;
  /**
   * How the array is ordered in the store object: "desc" collections are
   * prepended to (newest first), "asc" ones appended to. Rows carry a `seq`
   * assigned on insert, so reads rebuild the same order.
   */
  order: "asc" | "desc";
  /** Moving an updated row to the front, as the app does for resubmissions. */
  requeueOnUpdate?: boolean;
}

/**
 * Parents before children: inserts run in this order, deletes in reverse.
 * Foreign keys are also DEFERRABLE, so order is belt and braces.
 */
export const TABLES: TableSpec[] = [
  { table: "users", keyColumns: ["id"], order: "desc" },
  { table: "sessions", keyColumns: ["token"], order: "asc" },
  { table: "revoked_session_tokens", keyColumns: ["token"], keyOnly: true, order: "asc" },
  { table: "removed_users", keyColumns: ["user_id"], keyOnly: true, order: "asc" },
  { table: "account_tokens", keyColumns: ["token"], order: "asc" },
  { table: "parent_profiles", keyColumns: ["user_id"], order: "asc" },
  { table: "provider_profiles", keyColumns: ["user_id"], order: "asc" },
  { table: "uploads", keyColumns: ["id"], order: "desc" },
  { table: "conversations", keyColumns: ["id"], order: "desc" },
  { table: "messages", keyColumns: ["conversation_id", "id"], order: "asc" },
  { table: "pending_verifications", keyColumns: ["id"], order: "desc", requeueOnUpdate: true },
  { table: "approved_verifications", keyColumns: ["id"], order: "desc" },
];

export const TABLE_SPECS = Object.fromEntries(TABLES.map((spec) => [spec.table, spec])) as Record<
  TableName,
  TableSpec
>;

export interface RowValue {
  key: string[];
  /** null for key-only tables. */
  data: JsonObject | null;
  /** Stable serialisation used to detect changes. */
  serialized: string;
}

export type TableRows = Map<string, RowValue>;
export type StoreRows = Record<TableName, TableRows>;

/** JSON with object keys sorted, so equal records always serialise equally. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const sorted: JsonObject = {};
    for (const key of Object.keys(value as JsonObject).sort()) {
      const item = (value as JsonObject)[key];
      if (item !== undefined) sorted[key] = sortKeys(item);
    }
    return sorted;
  }
  return value;
}

/** Deep equality that ignores object key order and undefined members. */
export function sameJson(a: unknown, b: unknown) {
  return stableStringify(a) === stableStringify(b);
}

const rowKey = (key: string[]) => JSON.stringify(key);

function emptyRows(): StoreRows {
  return Object.fromEntries(TABLES.map((spec) => [spec.table, new Map()])) as StoreRows;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function put(rows: StoreRows, table: TableName, key: string[], data: JsonObject | null) {
  rows[table].set(rowKey(key), {
    key,
    data,
    serialized: data === null ? "" : stableStringify(data),
  });
}

/**
 * Splits a store object into table rows. The store must already be valid
 * (see analyzeStore for raw input): duplicates here would silently collapse.
 */
export function storeToRows(store: JsonObject): StoreRows {
  const rows = emptyRows();
  for (const user of asArray(store.users) as JsonObject[]) put(rows, "users", [text(user.id)], user);
  for (const session of asArray(store.sessions) as JsonObject[]) {
    put(rows, "sessions", [text(session.token)], session);
  }
  for (const token of asArray(store.revokedSessionTokens)) {
    put(rows, "revoked_session_tokens", [text(token)], null);
  }
  for (const userId of asArray(store.removedUserIds)) put(rows, "removed_users", [text(userId)], null);
  for (const token of asArray(store.accountTokens) as JsonObject[]) {
    put(rows, "account_tokens", [text(token.token)], token);
  }
  for (const [userId, profile] of Object.entries(asObject(store.parentProfiles))) {
    put(rows, "parent_profiles", [userId], asObject(profile));
  }
  for (const [userId, profile] of Object.entries(asObject(store.providerProfiles))) {
    put(rows, "provider_profiles", [userId], asObject(profile));
  }
  for (const upload of asArray(store.uploads) as JsonObject[]) put(rows, "uploads", [text(upload.id)], upload);
  for (const conversation of asArray(store.conversations) as JsonObject[]) {
    const { messages, ...rest } = conversation;
    put(rows, "conversations", [text(conversation.id)], rest);
    for (const message of asArray(messages) as JsonObject[]) {
      put(rows, "messages", [text(conversation.id), text(message.id)], message);
    }
  }
  const verifications = asObject(store.verifications);
  for (const item of asArray(verifications.pendingProviders) as JsonObject[]) {
    put(rows, "pending_verifications", [text(item.id)], item);
  }
  for (const item of asArray(verifications.approvedProviders) as JsonObject[]) {
    put(rows, "approved_verifications", [text(item.id)], item);
  }
  return rows;
}

export interface TableChanges {
  inserts: RowValue[];
  updates: RowValue[];
  deletes: RowValue[];
}

export type StoreChanges = Record<TableName, TableChanges>;

/** Row-level difference between two snapshots of the same store. */
export function diffRows(before: StoreRows, after: StoreRows): StoreChanges {
  const changes = {} as StoreChanges;
  for (const { table } of TABLES) {
    const inserts: RowValue[] = [];
    const updates: RowValue[] = [];
    const deletes: RowValue[] = [];
    for (const [key, row] of after[table]) {
      const previous = before[table].get(key);
      if (!previous) inserts.push(row);
      else if (previous.serialized !== row.serialized) updates.push(row);
    }
    for (const [key, row] of before[table]) {
      if (!after[table].has(key)) deletes.push(row);
    }
    changes[table] = { inserts, updates, deletes };
  }
  return changes;
}

export function countChanges(changes: StoreChanges) {
  return TABLES.reduce(
    (total, { table }) =>
      total + changes[table].inserts.length + changes[table].updates.length + changes[table].deletes.length,
    0
  );
}

// ---------------------------------------------------------------------------
// Source analysis for the one-time import from the legacy JSON document.
// ---------------------------------------------------------------------------

export interface AnalysisIssue {
  /** Machine-readable category, e.g. "duplicate-email". */
  kind: string;
  collection: string;
  count: number;
  /** Record identifiers only (ids, never emails, names or tokens). */
  examples: string[];
}

export interface StoreAnalysis {
  counts: Record<string, number>;
  /** Records the app already ignores on every read (dropped by normalizeStore). */
  ignored: AnalysisIssue[];
  /** Problems that block import until an operator decides how to resolve them. */
  blocking: AnalysisIssue[];
  /** Import-safe store: ignored records removed, everything else untouched. */
  importable: JsonObject;
}

const MAX_EXAMPLES = 5;

function issue(kind: string, collection: string, ids: string[]): AnalysisIssue {
  return { kind, collection, count: ids.length, examples: ids.slice(0, MAX_EXAMPLES) };
}

function redactToken(token: string) {
  return token ? `${token.slice(0, 6)}…(${token.length} chars)` : "(empty)";
}

/** Values that would collide on a unique key, listed once each. */
function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function normalizeEmailForKey(email: unknown) {
  return text(email).trim().toLowerCase();
}

/**
 * Checks a raw legacy store against every constraint in the schema. Nothing is
 * changed: records the app already discards on read are reported as ignored,
 * and anything else that would violate a constraint is reported as blocking.
 */
export function analyzeStore(raw: unknown): StoreAnalysis {
  const store = asObject(raw);
  const ignored: AnalysisIssue[] = [];
  const blocking: AnalysisIssue[] = [];
  const block = (kind: string, collection: string, ids: string[]) => {
    if (ids.length) blocking.push(issue(kind, collection, ids));
  };
  const ignore = (kind: string, collection: string, ids: string[]) => {
    if (ids.length) ignored.push(issue(kind, collection, ids));
  };

  const users = asArray(store.users) as JsonObject[];
  const userIds = new Set(users.map((user) => text(user.id)));
  block("missing-id", "users", users.filter((u) => !text(u.id)).map((_, i) => `index ${i}`));
  block("duplicate-id", "users", duplicates(users.map((u) => text(u.id)).filter(Boolean)));
  block("missing-email", "users", users.filter((u) => !normalizeEmailForKey(u.email)).map((u) => text(u.id)));
  const emailOwners = new Map<string, string[]>();
  for (const user of users) {
    const email = normalizeEmailForKey(user.email);
    if (!email) continue;
    emailOwners.set(email, [...(emailOwners.get(email) ?? []), text(user.id)]);
  }
  block(
    "duplicate-email",
    "users",
    [...emailOwners.values()].filter((ids) => ids.length > 1).map((ids) => ids.join(" + "))
  );
  block(
    "invalid-role",
    "users",
    users.filter((u) => !["parent", "provider", "admin"].includes(text(u.role))).map((u) => text(u.id))
  );

  const sessions = asArray(store.sessions) as JsonObject[];
  block("missing-token", "sessions", sessions.filter((s) => !text(s.token)).map((_, i) => `index ${i}`));
  block("duplicate-token", "sessions", duplicates(sessions.map((s) => text(s.token)).filter(Boolean)).map(redactToken));
  block(
    "orphan-user",
    "sessions",
    sessions.filter((s) => !userIds.has(text(s.userId))).map((s) => `user ${text(s.userId) || "(none)"}`)
  );

  const revoked = asArray(store.revokedSessionTokens).map(text);
  block("invalid-entry", "revokedSessionTokens", revoked.filter((t) => !t).map((_, i) => `index ${i}`));
  const revokedDuplicates = duplicates(revoked.filter(Boolean));
  block("duplicate-token", "revokedSessionTokens", revokedDuplicates.map(redactToken));

  const removed = asArray(store.removedUserIds).map(text);
  block("invalid-entry", "removedUserIds", removed.filter((t) => !t).map((_, i) => `index ${i}`));
  block("duplicate-id", "removedUserIds", duplicates(removed.filter(Boolean)));

  const accountTokens = asArray(store.accountTokens) as JsonObject[];
  block("missing-token", "accountTokens", accountTokens.filter((t) => !text(t.token)).map((_, i) => `index ${i}`));
  block("duplicate-token", "accountTokens", duplicates(accountTokens.map((t) => text(t.token)).filter(Boolean)).map(redactToken));
  block(
    "orphan-user",
    "accountTokens",
    accountTokens.filter((t) => !userIds.has(text(t.userId))).map((t) => `user ${text(t.userId) || "(none)"}`)
  );
  block(
    "invalid-type",
    "accountTokens",
    accountTokens
      .filter((t) => !["email-verification", "password-reset"].includes(text(t.type)))
      .map((t) => redactToken(text(t.token)))
  );

  const objectEntries = (name: "parentProfiles" | "providerProfiles") => {
    const value = store[name];
    if (value !== undefined && (typeof value !== "object" || Array.isArray(value) || value === null)) {
      block("not-an-object", name, [name]);
    }
    const entries = Object.entries(asObject(value));
    block(
      "invalid-record",
      name,
      entries.filter(([, profile]) => !profile || typeof profile !== "object" || Array.isArray(profile)).map(([id]) => id)
    );
    return entries;
  };
  objectEntries("parentProfiles");
  const providerEntries = objectEntries("providerProfiles");
  block(
    "invalid-verification-status",
    "providerProfiles",
    providerEntries
      .filter(([, p]) => {
        const status = asObject(p).verificationStatus;
        return status !== undefined && !["not_submitted", "pending", "approved", "rejected"].includes(text(status));
      })
      .map(([id]) => id)
  );
  block(
    "invalid-payment-status",
    "providerProfiles",
    providerEntries
      .filter(([, p]) => {
        const status = asObject(p).verificationPaymentStatus;
        return status !== undefined && !["unpaid", "paid"].includes(text(status));
      })
      .map(([id]) => id)
  );

  const uploads = asArray(store.uploads) as JsonObject[];
  block("missing-id", "uploads", uploads.filter((u) => !text(u.id)).map((_, i) => `index ${i}`));
  block("duplicate-id", "uploads", duplicates(uploads.map((u) => text(u.id)).filter(Boolean)));
  block(
    "invalid-type",
    "uploads",
    uploads
      .filter((u) => !["document", "gallery", "profile-image", "cover-image"].includes(text(u.type)))
      .map((u) => text(u.id))
  );

  // normalizeStore drops conversations without parentUserId/providerId on every
  // read, so the app has never been able to see them: they are not imported.
  const allConversations = asArray(store.conversations) as JsonObject[];
  const invisibleConversations = allConversations.filter(
    (c) => typeof c.parentUserId !== "string" || typeof c.providerId !== "string"
  );
  ignore("dropped-by-normalize", "conversations", invisibleConversations.map((c) => text(c.id) || "(no id)"));
  const conversations = allConversations.filter((c) => !invisibleConversations.includes(c));
  block("missing-id", "conversations", conversations.filter((c) => !text(c.id)).map((_, i) => `index ${i}`));
  block("duplicate-id", "conversations", duplicates(conversations.map((c) => text(c.id)).filter(Boolean)));
  block(
    "duplicate-parent-provider",
    "conversations",
    duplicates(conversations.map((c) => `${text(c.parentUserId)}|${text(c.providerId)}`)).map((pair) => pair.replace("|", " -> "))
  );
  const messageProblems: string[] = [];
  const messageDuplicates: string[] = [];
  for (const conversation of conversations) {
    const messages = asArray(conversation.messages) as JsonObject[];
    if (conversation.messages !== undefined && !Array.isArray(conversation.messages)) {
      messageProblems.push(`${text(conversation.id)}: messages is not a list`);
    }
    messages.filter((m) => !text(m.id)).forEach(() => messageProblems.push(`${text(conversation.id)}: message without id`));
    duplicates(messages.map((m) => text(m.id)).filter(Boolean)).forEach((id) =>
      messageDuplicates.push(`${text(conversation.id)}/${id}`)
    );
  }
  block("invalid-message", "messages", messageProblems);
  block("duplicate-id", "messages", messageDuplicates);

  // normalizeStore drops pending verifications without a userId, and the old
  // seeded demo approvals, on every read.
  const verifications = asObject(store.verifications);
  const allPending = asArray(verifications.pendingProviders) as JsonObject[];
  const invisiblePending = allPending.filter((p) => !p.userId);
  ignore("dropped-by-normalize", "pendingProviders", invisiblePending.map((p) => text(p.id) || "(no id)"));
  const pending = allPending.filter((p) => !invisiblePending.includes(p));
  block("missing-id", "pendingProviders", pending.filter((p) => !text(p.id)).map((_, i) => `index ${i}`));
  block("duplicate-id", "pendingProviders", duplicates(pending.map((p) => text(p.id)).filter(Boolean)));

  const allApproved = asArray(verifications.approvedProviders) as JsonObject[];
  const invisibleApproved = allApproved.filter(
    (a) => !a.userId && LEGACY_DEMO_APPROVED_VERIFICATION_IDS.includes(text(a.id))
  );
  ignore("dropped-by-normalize", "approvedProviders", invisibleApproved.map((a) => text(a.id)));
  const approved = allApproved.filter((a) => !invisibleApproved.includes(a));
  block("missing-id", "approvedProviders", approved.filter((a) => !text(a.id)).map((_, i) => `index ${i}`));
  block("duplicate-id", "approvedProviders", duplicates(approved.map((a) => text(a.id)).filter(Boolean)));

  const rejectedCount = verifications.rejectedCount;
  if (rejectedCount !== undefined && !(Number.isInteger(rejectedCount) && (rejectedCount as number) >= 0)) {
    block("invalid-value", "verifications.rejectedCount", ["rejectedCount"]);
  }

  const importable: JsonObject = {
    ...store,
    conversations,
    verifications: {
      ...verifications,
      pendingProviders: pending,
      approvedProviders: approved,
    },
  };

  const messageCount = conversations.reduce((sum, c) => sum + asArray(c.messages).length, 0);
  return {
    counts: {
      users: users.length,
      sessions: sessions.length,
      revokedSessionTokens: revoked.length,
      removedUserIds: removed.length,
      accountTokens: accountTokens.length,
      parentProfiles: Object.keys(asObject(store.parentProfiles)).length,
      providerProfiles: providerEntries.length,
      uploads: uploads.length,
      conversations: allConversations.length,
      messages: messageCount,
      pendingProviders: allPending.length,
      approvedProviders: allApproved.length,
      providerAnalytics: Object.keys(asObject(store.providerAnalytics)).length,
    },
    ignored,
    blocking,
    importable,
  };
}

/**
 * The store as the database returns it, for reconciliation against the source:
 * key order and absent optional members are ignored, list order is not.
 */
export function comparableStore(store: JsonObject) {
  const verifications = asObject(store.verifications);
  return {
    users: asArray(store.users),
    sessions: asArray(store.sessions),
    revokedSessionTokens: asArray(store.revokedSessionTokens),
    removedUserIds: asArray(store.removedUserIds),
    accountTokens: asArray(store.accountTokens),
    parentProfiles: asObject(store.parentProfiles),
    providerProfiles: asObject(store.providerProfiles),
    uploads: asArray(store.uploads),
    conversations: asArray(store.conversations).map((c) => ({
      ...asObject(c),
      messages: asArray(asObject(c).messages),
    })),
    pendingProviders: asArray(verifications.pendingProviders),
    approvedProviders: asArray(verifications.approvedProviders),
    rejectedCount: Number(verifications.rejectedCount) || 0,
  };
}

/** Collections whose source and database copies differ (empty when identical). */
export function reconcileStores(source: JsonObject, database: JsonObject) {
  const a = comparableStore(source);
  const b = comparableStore(database);
  return (Object.keys(a) as Array<keyof typeof a>).filter((key) => !sameJson(a[key], b[key]));
}
