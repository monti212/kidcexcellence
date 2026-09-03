// Transport for Cloudflare D1.
//
// D1 has no wire protocol of its own: you reach it either through a Workers
// binding, or over HTTP. This module hides that choice behind `d1Batch()` so
// lib/platform-store-d1.ts only ever thinks in statements.
//
// Two transports are implemented:
//
//   proxy — POST a whole batch to a Worker you deploy (see d1/proxy-worker/),
//           which runs it against its D1 binding with env.DB.batch(). One HTTP
//           request per batch regardless of statement count. This is the
//           production path.
//
//   rest  — Cloudflare's REST API, one request per statement. Cloudflare
//           documents this as "best suited for administrative use, as the
//           global Cloudflare API rate limit applies" — that limit is 1200
//           requests per five minutes for the WHOLE account. readStore() issues
//           14 statements per call, so this transport is for local development,
//           migrations, and scripts. It will not survive production traffic.
//
// A native binding transport (running the app itself on Workers) would slot in
// here as a third mode; it is not implemented because the app currently
// deploys to a Node function and writes uploads to the filesystem.

export interface D1Statement {
  sql: string;
  params?: unknown[];
}

export type D1Row = Record<string, unknown>;

/**
 * D1 rejects any single statement with more than 100 bound parameters
 * ("too many SQL variables"). Callers building multi-row statements must chunk
 * against this.
 */
export const D1_MAX_BOUND_PARAMS = 100;

function proxyConfig() {
  const url = process.env.D1_PROXY_URL?.trim();
  const token = process.env.D1_PROXY_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

function restConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}

export function d1TransportMode(): "proxy" | "rest" | null {
  if (proxyConfig()) return "proxy";
  if (restConfig()) return "rest";
  return null;
}

export function d1Enabled() {
  return d1TransportMode() !== null;
}

function missingConfigError() {
  return new Error(
    "Cloudflare D1 is not configured. Set D1_PROXY_URL and D1_PROXY_TOKEN (production), " +
      "or CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_API_TOKEN " +
      "(development), or set PLATFORM_STORE_DRIVER=json to use the local JSON store."
  );
}

export const D1_MISSING_SCHEMA_HINT =
  "The platform tables are missing. Apply every file in d1/migrations/ to the database " +
  "(`npx wrangler d1 execute <db> --remote --file=./d1/migrations/0001_platform_store.sql`), " +
  "or set PLATFORM_STORE_DRIVER=json to use the local JSON store.";

function d1Error(action: string, message: string) {
  const schemaMissing = /no such table/i.test(message);
  return new Error(
    `Failed to ${action} Cloudflare D1: ${message}${schemaMissing ? `\n${D1_MISSING_SCHEMA_HINT}` : ""}`
  );
}

interface CloudflareQueryResult {
  success: boolean;
  results?: D1Row[];
  error?: string;
}

async function runViaProxy(statements: D1Statement[]): Promise<D1Row[][]> {
  const config = proxyConfig()!;
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ batch: statements }),
  });

  const payload = (await response.json().catch(() => null)) as {
    results?: CloudflareQueryResult[];
    error?: string;
  } | null;

  if (!response.ok || !payload?.results) {
    throw d1Error("query", payload?.error ?? `proxy responded ${response.status}`);
  }

  return payload.results.map((result) => result.results ?? []);
}

async function runOneViaRest(statement: D1Statement): Promise<D1Row[]> {
  const config = restConfig()!;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({ sql: statement.sql, params: statement.params ?? [] }),
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    result?: CloudflareQueryResult[];
    errors?: Array<{ message: string }>;
  } | null;

  if (!response.ok || !payload?.success) {
    throw d1Error(
      "query",
      payload?.errors?.map((error) => error.message).join("; ") ??
        `REST API responded ${response.status}`
    );
  }

  return payload.result?.[0]?.results ?? [];
}

/**
 * Runs statements in order and returns each one's rows.
 *
 * The proxy transport sends the whole batch in a single request. The REST
 * transport has no batch endpoint that accepts per-statement parameters, so it
 * issues one request per statement, in sequence — order matters because the
 * store's writes depend on foreign keys resolving.
 */
export async function d1Batch(statements: D1Statement[]): Promise<D1Row[][]> {
  if (statements.length === 0) return [];

  const overSized = statements.find(
    (statement) => (statement.params?.length ?? 0) > D1_MAX_BOUND_PARAMS
  );
  if (overSized) {
    throw new Error(
      `A D1 statement bound ${overSized.params?.length} parameters; the limit is ${D1_MAX_BOUND_PARAMS}. This is a bug in the caller's chunking.`
    );
  }

  const mode = d1TransportMode();
  if (mode === "proxy") return runViaProxy(statements);
  if (mode === "rest") {
    const results: D1Row[][] = [];
    for (const statement of statements) {
      results.push(await runOneViaRest(statement));
    }
    return results;
  }
  throw missingConfigError();
}
