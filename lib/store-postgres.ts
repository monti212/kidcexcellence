import { getConnectionString, getDatabase } from "@netlify/database";
import { STORE_BUSY_MESSAGE, StoreBusyError } from "./store-engine.ts";
import {
  TABLES,
  TABLE_SPECS,
  countChanges,
  diffRows,
  storeToRows,
  type JsonObject,
  type RowValue,
  type StoreChanges,
  type TableName,
} from "./store-records.ts";

/*
 * Postgres persistence for the platform store (Netlify Database in deployed
 * environments, any Postgres via PLATFORM_DATABASE_URL elsewhere).
 *
 * Guarantees:
 *   * Every write runs in one transaction that first takes a transaction-scoped
 *     advisory lock, so writers are serialised: an update always starts from
 *     the latest committed state and cannot overwrite another writer's change.
 *   * A request is only acknowledged after COMMIT returns. Any failure before
 *     that rolls the whole transaction back and surfaces as an error.
 *   * Reads take no lock and never write (one statement, one snapshot).
 *
 * This file has no "@/" imports so tests can load it with Node directly.
 */

/** Arbitrary constant: the advisory lock every store writer serialises on. */
const STORE_LOCK_KEY = 7_316_190_224;
/** How long a writer waits for the store lock before answering "busy". */
const lockTimeout = () => process.env.PLATFORM_DATABASE_LOCK_TIMEOUT?.trim() || "8s";
/** pg.Pool waits forever for a connection by default; never hang a request. */
const CONNECT_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT = "15s";
const IDLE_IN_TRANSACTION_TIMEOUT = "15s";
const MAX_TRANSIENT_RETRIES = 3;

export const STORE_UNAVAILABLE_MESSAGE =
  "Kidcellence could not reach its database, so nothing was saved. Please try again shortly.";
export const STORE_NOT_INITIALIZED_MESSAGE =
  "Kidcellence is finishing a scheduled data migration. Please try again in a few minutes.";
const STORE_INTEGRITY_MESSAGE =
  "This change conflicts with existing records, so nothing was saved. Please refresh and try again.";

export class StoreUnavailableError extends Error {
  code = "STORE_UNAVAILABLE";
  constructor(message = STORE_UNAVAILABLE_MESSAGE, cause?: unknown) {
    super(message, { cause });
    this.name = "StoreUnavailableError";
  }
}

export class StoreIntegrityError extends Error {
  code = "STORE_INTEGRITY";
  constructor(cause?: unknown) {
    super(STORE_INTEGRITY_MESSAGE, { cause });
    this.name = "StoreIntegrityError";
  }
}

interface QueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

export interface Queryable {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
}

interface PoolClientLike extends Queryable {
  release(destroy?: boolean | Error): void;
  on?(event: "error", listener: (error: Error) => void): unknown;
}

const guardedClients = new WeakSet<object>();

/**
 * A connection the server drops while it is checked out emits "error" on the
 * client between queries. Unhandled, that event would crash the whole process;
 * handled, the next query on the client fails and the transaction is reported
 * as unavailable.
 */
function guardClient(client: PoolClientLike) {
  if (guardedClients.has(client)) return client;
  guardedClients.add(client);
  client.on?.("error", (error) => console.error("[store-postgres] connection error", error));
  return client;
}

interface PoolLike {
  connect(): Promise<PoolClientLike>;
  on?(event: "error", listener: (error: Error) => void): unknown;
  end(): Promise<void>;
}

/** Writers are serialised, so a few connections per instance are plenty. */
const MAX_CONNECTIONS_PER_INSTANCE = 5;

type PoolCache = { connectionString: string; pool: PoolLike } | null;
// One pool per process, even if the bundler includes this module more than once.
const poolHolder = globalThis as typeof globalThis & { __kidcellenceStorePool?: PoolCache };

/** True when a database is configured for this process. */
export function databaseConfigured() {
  return Boolean(process.env.PLATFORM_DATABASE_URL?.trim() || process.env.NETLIFY_DB_URL?.trim());
}

function configuredConnectionString() {
  const override = process.env.PLATFORM_DATABASE_URL?.trim();
  if (override) return { connectionString: override, override: true };
  try {
    return { connectionString: getConnectionString(), override: false };
  } catch (error) {
    // MissingDatabaseConnectionError: no database for this environment.
    console.error("[store-postgres] no database is configured for this environment", error);
    throw new StoreUnavailableError(STORE_UNAVAILABLE_MESSAGE, error);
  }
}

function databasePool(): PoolLike {
  const { connectionString, override } = configuredConnectionString();
  const cached = poolHolder.__kidcellenceStorePool;
  if (cached?.connectionString === connectionString) return cached.pool;

  const database = getDatabase(override ? { connectionString } : {});
  const pool = database.pool as unknown as PoolLike & { options?: { max?: number } };
  if (pool.options) pool.options.max = MAX_CONNECTIONS_PER_INSTANCE;
  // An idle pooled connection can be closed by the server at any time; without
  // a listener that would crash the process instead of failing one request.
  pool.on?.("error", (error) => console.error("[store-postgres] idle connection error", error));
  poolHolder.__kidcellenceStorePool = { connectionString, pool };
  // Credentials can rotate: retire the pool built for the old connection string.
  if (cached) void cached.pool.end().catch(() => undefined);
  return pool;
}

async function connectClient(): Promise<PoolClientLike> {
  const pool = databasePool();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connecting = pool.connect();
  try {
    return await Promise.race([
      connecting.then(guardClient),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error("timeout exceeded when trying to connect"));
        }, CONNECT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    // A connection that arrives after we gave up must go back to the pool.
    if (timedOut) void connecting.then((client) => client.release()).catch(() => undefined);
    console.error("[store-postgres] could not connect to the database", error);
    throw new StoreUnavailableError(STORE_UNAVAILABLE_MESSAGE, error);
  } finally {
    clearTimeout(timer);
  }
}

/** Closes the pool (tests and scripts). */
export async function closeDatabasePool() {
  const pool = poolHolder.__kidcellenceStorePool?.pool;
  poolHolder.__kidcellenceStorePool = null;
  if (pool) await pool.end();
}

const SQLSTATE = /^[0-9A-Z]{5}$/;
const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
]);

function errorCode(error: unknown) {
  return typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "";
}

function isTransientConflict(error: unknown) {
  // serialization_failure, deadlock_detected
  return ["40001", "40P01"].includes(errorCode(error));
}

/**
 * Turns database and network failures into the store's error types. Errors
 * thrown by application code (validation in an updater) pass through as-is.
 */
export function classifyDatabaseError(error: unknown): unknown {
  if (
    error instanceof StoreUnavailableError ||
    error instanceof StoreIntegrityError ||
    error instanceof StoreBusyError
  ) {
    return error;
  }
  const code = errorCode(error);
  if (code === "55P03" || code === "57014" || isTransientConflict(error)) {
    // lock_not_available (lock_timeout), query_canceled (statement_timeout)
    console.error("[store-postgres] database busy", error);
    return new StoreBusyError(STORE_BUSY_MESSAGE);
  }
  if (code.startsWith("23")) {
    console.error("[store-postgres] integrity constraint rejected a write", error);
    return new StoreIntegrityError(error);
  }
  const message = error instanceof Error ? error.message : "";
  if (
    (SQLSTATE.test(code) && /^(08|53|57|58|XX|25P03)/.test(code)) ||
    CONNECTION_ERROR_CODES.has(code) ||
    /connection (terminated|ended|closed|error)|Connection terminated|socket|websocket|timeout exceeded when trying to connect/i.test(
      message
    )
  ) {
    console.error("[store-postgres] database unavailable", error);
    return new StoreUnavailableError(STORE_UNAVAILABLE_MESSAGE, error);
  }
  if (SQLSTATE.test(code)) {
    console.error("[store-postgres] database error", error);
    return new StoreUnavailableError(STORE_UNAVAILABLE_MESSAGE, error);
  }
  return error;
}

interface TransactionOptions {
  /** Serialise with every other store writer. */
  storeLock: boolean;
}

/**
 * Runs `work` in one transaction and commits. `work` may run again (on a fresh
 * snapshot) after a deadlock or serialization failure, so it must only change
 * state through the client it is given.
 */
export async function withTransaction<T>(
  work: (client: Queryable) => Promise<T>,
  options: TransactionOptions
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const client = await connectClient();
    let broken = false;
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT set_config('lock_timeout', $1, true), set_config('statement_timeout', $2, true), " +
          "set_config('idle_in_transaction_session_timeout', $3, true)",
        [lockTimeout(), STATEMENT_TIMEOUT, IDLE_IN_TRANSACTION_TIMEOUT]
      );
      if (options.storeLock) {
        await client.query("SELECT pg_advisory_xact_lock($1)", [STORE_LOCK_KEY]);
      }
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {
        broken = true;
      });
      if (isTransientConflict(error) && attempt < MAX_TRANSIENT_RETRIES) continue;
      throw classifyDatabaseError(error);
    } finally {
      client.release(broken);
    }
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function orderedArray(table: TableName, expression: string) {
  const direction = TABLE_SPECS[table].order === "desc" ? "DESC" : "ASC";
  return `COALESCE((SELECT json_agg(${expression} ORDER BY seq ${direction}) FROM ${table}), '[]'::json)`;
}

const MAIN_STORE_COLUMNS = [
  `(SELECT value FROM platform_meta WHERE key = 'data_source') AS data_source`,
  `${orderedArray("users", "data")} AS users`,
  `${orderedArray("sessions", "data")} AS sessions`,
  `${orderedArray("revoked_session_tokens", "token")} AS revoked_session_tokens`,
  `${orderedArray("removed_users", "user_id")} AS removed_user_ids`,
  `${orderedArray("account_tokens", "data")} AS account_tokens`,
  `COALESCE((SELECT json_object_agg(user_id, data ORDER BY seq) FROM parent_profiles), '{}'::json) AS parent_profiles`,
  `COALESCE((SELECT json_object_agg(user_id, data ORDER BY seq) FROM provider_profiles), '{}'::json) AS provider_profiles`,
  `${orderedArray("uploads", "data")} AS uploads`,
  `COALESCE((
     SELECT json_agg(
       (c.data || jsonb_build_object('messages', COALESCE((
         SELECT jsonb_agg(m.data ORDER BY m.seq) FROM messages m WHERE m.conversation_id = c.id
       ), '[]'::jsonb)))::json
       ORDER BY c.seq DESC)
     FROM conversations c
   ), '[]'::json) AS conversations`,
  `${orderedArray("pending_verifications", "data")} AS pending_verifications`,
  `${orderedArray("approved_verifications", "data")} AS approved_verifications`,
  `(SELECT value FROM platform_meta WHERE key = 'rejected_count') AS rejected_count`,
];

const ANALYTICS_COLUMNS = [
  `(SELECT data FROM platform_analytics WHERE id = 1) AS platform_analytics`,
  `COALESCE((SELECT json_object_agg(user_id, data) FROM provider_analytics), '{}'::json) AS provider_analytics`,
];

export interface DatabaseSnapshot {
  /** The main store in the application's legacy object shape (not normalised). */
  store: JsonObject;
  platformAnalytics: JsonObject | null;
  providerAnalytics: Record<string, JsonObject>;
  dataSource: JsonObject | null;
}

function rowToSnapshot(row: Record<string, unknown>, withAnalytics: boolean): DatabaseSnapshot {
  const store: JsonObject = {
    users: row.users,
    sessions: row.sessions,
    revokedSessionTokens: row.revoked_session_tokens,
    removedUserIds: row.removed_user_ids,
    accountTokens: row.account_tokens,
    parentProfiles: row.parent_profiles,
    providerProfiles: row.provider_profiles,
    uploads: row.uploads,
    conversations: row.conversations,
    verifications: {
      pendingProviders: row.pending_verifications,
      approvedProviders: row.approved_verifications,
      rejectedCount: Number(row.rejected_count ?? 0) || 0,
    },
  };
  return {
    store,
    platformAnalytics: withAnalytics ? ((row.platform_analytics as JsonObject | null) ?? null) : null,
    providerAnalytics: withAnalytics ? ((row.provider_analytics as Record<string, JsonObject>) ?? {}) : {},
    dataSource: (row.data_source as JsonObject | null) ?? null,
  };
}

/** One statement, so every collection comes from the same committed snapshot. */
export async function loadSnapshot(client: Queryable, withAnalytics: boolean) {
  const columns = withAnalytics ? [...MAIN_STORE_COLUMNS, ...ANALYTICS_COLUMNS] : MAIN_STORE_COLUMNS;
  const result = await client.query(`SELECT ${columns.join(",\n")}`);
  return rowToSnapshot(result.rows[0] ?? {}, withAnalytics);
}

/**
 * An empty start is only for previews and local work. Production is detected
 * by CONTEXT where present and, reliably, by the production-only uploads flag
 * (PLATFORM_BLOB_STORE_ALLOW_PRODUCTION), so a mis-scoped variable cannot open
 * an empty production site.
 */
function emptyInitAllowed() {
  return (
    process.env.PLATFORM_DATABASE_ALLOW_EMPTY_INIT === "true" &&
    process.env.CONTEXT !== "production" &&
    process.env.PLATFORM_BLOB_STORE_ALLOW_PRODUCTION !== "true"
  );
}

/**
 * The database only serves data once it has a data source: either a completed
 * import of the legacy store, or (outside production, when explicitly allowed)
 * an empty start. Until then every request fails with 503, so a deploy that
 * lands before the import can never present an empty site or accept writes
 * that the import would then collide with.
 */
async function ensureInitialized(snapshot: DatabaseSnapshot) {
  if (snapshot.dataSource) return;
  if (!emptyInitAllowed()) {
    throw new StoreUnavailableError(STORE_NOT_INITIALIZED_MESSAGE);
  }
  await withTransaction(
    async (client) => {
      const existing = await client.query("SELECT 1 FROM platform_meta WHERE key = 'data_source'");
      if (existing.rowCount) return;
      const nonEmpty = await client.query(
        TABLES.map(({ table }) => `SELECT 1 FROM ${table}`).join(" UNION ALL ") + " LIMIT 1"
      );
      if (nonEmpty.rowCount) {
        // Data without a data-source marker means a partial import: refuse.
        throw new StoreUnavailableError(STORE_NOT_INITIALIZED_MESSAGE);
      }
      await client.query(
        "INSERT INTO platform_meta (key, value) VALUES ('data_source', $1::jsonb)",
        [JSON.stringify({ kind: "empty", initializedAt: new Date().toISOString() })]
      );
    },
    { storeLock: true }
  );
}

export async function readDatabaseStore(withAnalytics: boolean): Promise<DatabaseSnapshot> {
  let snapshot: DatabaseSnapshot;
  const client = await connectClient();
  let broken = false;
  try {
    snapshot = await loadSnapshot(client, withAnalytics);
  } catch (error) {
    broken = true;
    const classified = classifyDatabaseError(error);
    throw classified === error ? new StoreUnavailableError(STORE_UNAVAILABLE_MESSAGE, error) : classified;
  } finally {
    client.release(broken);
  }
  if (!snapshot.dataSource) {
    await ensureInitialized(snapshot);
    return readDatabaseStore(withAnalytics);
  }
  return snapshot;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function keyWhere(table: TableName, offset: number) {
  return TABLE_SPECS[table].keyColumns.map((column, i) => `${column} = $${offset + i}`).join(" AND ");
}

async function applyChanges(client: Queryable, changes: StoreChanges) {
  // Children before parents for deletes; parents before children for inserts.
  for (const { table } of [...TABLES].reverse()) {
    for (const row of changes[table].deletes) {
      await client.query(`DELETE FROM ${table} WHERE ${keyWhere(table, 1)}`, row.key);
    }
  }
  for (const spec of TABLES) {
    const { table, keyColumns, keyOnly, requeueOnUpdate } = spec;
    for (const row of changes[table].inserts) {
      await insertRow(client, table, keyColumns, keyOnly, row);
    }
    if (keyOnly) continue;
    for (const row of changes[table].updates) {
      const requeue = requeueOnUpdate ? `, seq = nextval(pg_get_serial_sequence('${table}', 'seq'))` : "";
      const result = await client.query(
        `UPDATE ${table} SET data = $1::jsonb, updated_at = now()${requeue} WHERE ${keyWhere(table, 2)}`,
        [JSON.stringify(row.data), ...row.key]
      );
      if (result.rowCount !== 1) {
        throw new StoreIntegrityError(new Error(`${table} row to update was missing`));
      }
    }
  }
}

async function insertRow(
  client: Queryable,
  table: TableName,
  keyColumns: string[],
  keyOnly: boolean | undefined,
  row: RowValue,
  seq?: number
) {
  const columns = [...keyColumns, ...(keyOnly ? [] : ["data"]), ...(seq === undefined ? [] : ["seq"])];
  const values: unknown[] = [...row.key, ...(keyOnly ? [] : [JSON.stringify(row.data)]), ...(seq === undefined ? [] : [seq])];
  const placeholders = columns.map((column, i) => (column === "data" ? `$${i + 1}::jsonb` : `$${i + 1}`));
  await client.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`, values);
}

/** Lets an update change analytics rows inside the same transaction. */
export interface AnalyticsTransaction {
  updateProviderAnalytics(userId: string, mutate: (data: JsonObject) => JsonObject): Promise<void>;
  deleteProviderAnalytics(userId: string): Promise<void>;
}

function analyticsTransaction(client: Queryable): AnalyticsTransaction {
  return {
    updateProviderAnalytics: (userId, mutate) => updateProviderAnalyticsRow(client, userId, mutate),
    deleteProviderAnalytics: async (userId) => {
      await client.query("DELETE FROM provider_analytics WHERE user_id = $1", [userId]);
    },
  };
}

async function updateProviderAnalyticsRow(
  client: Queryable,
  userId: string,
  mutate: (data: JsonObject) => JsonObject
) {
  await client.query(
    "INSERT INTO provider_analytics (user_id, data) VALUES ($1, '{}'::jsonb) ON CONFLICT (user_id) DO NOTHING",
    [userId]
  );
  const current = await client.query("SELECT data FROM provider_analytics WHERE user_id = $1 FOR UPDATE", [userId]);
  const next = mutate((current.rows[0]?.data as JsonObject) ?? {});
  await client.query("UPDATE provider_analytics SET data = $2::jsonb, updated_at = now() WHERE user_id = $1", [
    userId,
    JSON.stringify(next),
  ]);
}

/**
 * Serialised read-modify-write of the main store.
 *
 * `normalize` turns the stored shape into the application's PlatformStore. The
 * updater mutates that object; only rows that actually changed are written.
 * `afterUpdate` runs inside the same transaction (for analytics that must commit
 * together with the change, or not at all).
 */
export async function updateDatabaseStore<S extends object, R>(
  normalize: (raw: JsonObject) => S,
  updater: (store: S) => R | Promise<R>,
  afterUpdate?: (result: R, analytics: AnalyticsTransaction) => Promise<void>
): Promise<R> {
  const run = () =>
    withTransaction(
      async (client) => {
        const snapshot = await loadSnapshot(client, false);
        if (!snapshot.dataSource) return { initialized: false as const };
        const store = normalize(snapshot.store);
        const before = storeToRows(store as JsonObject);
        const beforeRejected = rejectedCountOf(store as JsonObject);
        const result = await updater(store);
        const changes = diffRows(before, storeToRows(store as JsonObject));
        if (countChanges(changes)) await applyChanges(client, changes);
        const afterRejected = rejectedCountOf(store as JsonObject);
        if (afterRejected !== beforeRejected) {
          await client.query(
            `INSERT INTO platform_meta (key, value) VALUES ('rejected_count', $1::jsonb)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [JSON.stringify(afterRejected)]
          );
        }
        if (afterUpdate) await afterUpdate(result, analyticsTransaction(client));
        return { initialized: true as const, result };
      },
      { storeLock: true }
    );

  let outcome = await run();
  if (!outcome.initialized) {
    await ensureInitialized({ store: {}, platformAnalytics: null, providerAnalytics: {}, dataSource: null });
    outcome = await run();
    if (!outcome.initialized) throw new StoreUnavailableError(STORE_NOT_INITIALIZED_MESSAGE);
  }
  return outcome.result;
}

function rejectedCountOf(store: JsonObject) {
  const verifications = store.verifications as { rejectedCount?: unknown } | undefined;
  return Number(verifications?.rejectedCount ?? 0) || 0;
}

async function assertInitializedInTransaction(client: Queryable) {
  const marker = await client.query("SELECT 1 FROM platform_meta WHERE key = 'data_source'");
  if (!marker.rowCount) throw new StoreUnavailableError(STORE_NOT_INITIALIZED_MESSAGE);
}

/**
 * Updates the platform-wide analytics row under its own row lock. Independent
 * of the store lock, so page views never wait on account or message writes.
 */
export async function updateDatabasePlatformAnalytics<R>(
  mutate: (data: JsonObject) => { data: JsonObject; result: R }
): Promise<R> {
  return withTransaction(
    async (client) => {
      await assertInitializedInTransaction(client);
      await client.query(
        "INSERT INTO platform_analytics (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING"
      );
      const current = await client.query("SELECT data FROM platform_analytics WHERE id = 1 FOR UPDATE");
      const { data, result } = mutate((current.rows[0]?.data as JsonObject) ?? {});
      await client.query("UPDATE platform_analytics SET data = $1::jsonb, updated_at = now() WHERE id = 1", [
        JSON.stringify(data),
      ]);
      return result;
    },
    { storeLock: false }
  );
}

/** Updates one provider's analytics row under its own row lock. */
export async function updateDatabaseProviderAnalytics(
  userId: string,
  mutate: (data: JsonObject) => JsonObject
): Promise<void> {
  await withTransaction(
    async (client) => {
      await assertInitializedInTransaction(client);
      await updateProviderAnalyticsRow(client, userId, mutate);
    },
    { storeLock: false }
  );
}

// ---------------------------------------------------------------------------
// Bulk import (used by the migration tool; never by request handlers)
// ---------------------------------------------------------------------------

/**
 * Inserts a whole store into empty tables, preserving list order through
 * explicit `seq` values. Must run inside a transaction holding the store lock.
 */
export async function insertWholeStore(
  client: Queryable,
  store: JsonObject,
  analytics: { platformAnalytics: JsonObject | null; providerAnalytics: Record<string, JsonObject> }
) {
  const rows = storeToRows(store);
  for (const { table, keyColumns, keyOnly, order } of TABLES) {
    const list = [...rows[table].values()];
    let index = 0;
    for (const row of list) {
      // "desc" lists are newest-first: the first element gets the highest seq.
      const seq = order === "desc" ? list.length - index : index + 1;
      await insertRow(client, table, keyColumns, keyOnly, row, seq);
      index += 1;
    }
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'seq'), GREATEST((SELECT COALESCE(MAX(seq), 0) FROM ${table}), 1))`
    );
  }
  await client.query(
    `INSERT INTO platform_meta (key, value) VALUES ('rejected_count', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(rejectedCountOf(store))]
  );
  if (analytics.platformAnalytics) {
    await client.query("INSERT INTO platform_analytics (id, data) VALUES (1, $1::jsonb)", [
      JSON.stringify(analytics.platformAnalytics),
    ]);
  }
  for (const [userId, data] of Object.entries(analytics.providerAnalytics)) {
    await client.query("INSERT INTO provider_analytics (user_id, data) VALUES ($1, $2::jsonb)", [
      userId,
      JSON.stringify(data),
    ]);
  }
}

export const STORE_ADVISORY_LOCK_KEY = STORE_LOCK_KEY;
