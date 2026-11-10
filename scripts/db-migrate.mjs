#!/usr/bin/env node
// One-time migration of the legacy JSON platform store (Netlify Blobs
// `platform-store.json`) into Netlify Database, plus the reverse export used for
// rollback. See docs/production-migration-runbook.md before running against
// production.
//
//   analyze  --source <store.json> [--analytics <analytics.json>]
//   dry-run  --source <store.json> [--analytics ...] [--drop-orphan-sessions] [--drop-orphan-account-tokens]
//   import   --source <store.json> --database-url <url> --expect-sha256 <hash> [--analytics ...] [--drop-...]
//   verify   --source <store.json> --database-url <url> [--analytics ...] [--drop-...]
//   export   --database-url <url> --out <file>
//
// Output never contains emails, names, password hashes or tokens: only counts,
// record ids and hashes. Source files contain personal data: keep them
// encrypted and outside the repository.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const lib = (name) => pathToFileURL(path.join(process.cwd(), "lib", name)).href;
const { analyzeStore, reconcileStores, sameJson } = await import(lib("store-records.ts"));
const { STORE_ADVISORY_LOCK_KEY, insertWholeStore, loadSnapshot } = await import(lib("store-postgres.ts"));

class UsageError extends Error {}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { flags: new Set() };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) throw new UsageError(`Unexpected argument ${arg}`);
    const name = arg.slice(2);
    if (["drop-orphan-sessions", "drop-orphan-account-tokens"].includes(name)) {
      options.flags.add(name);
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith("--")) throw new UsageError(`--${name} needs a value`);
    options[name] = value;
    i += 1;
  }
  return { command, options };
}

async function readSource(options) {
  if (!options.source) throw new UsageError("--source is required");
  const raw = await readFile(options.source, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");
  let store;
  try {
    store = JSON.parse(raw);
  } catch {
    throw new Error("The source file is not valid JSON. Nothing was imported.");
  }
  if (!store || typeof store !== "object" || Array.isArray(store)) {
    throw new Error("The source file is not a platform store object. Nothing was imported.");
  }
  let analyticsDocument = null;
  if (options.analytics) {
    analyticsDocument = JSON.parse(await readFile(options.analytics, "utf8"));
  }
  return { store, sha256, analyticsDocument };
}

/**
 * The import plan: the analysed store, explicitly requested orphan drops, and
 * the analytics to load. Throws (importing nothing) if anything blocks.
 */
function plan({ store, analyticsDocument }, flags) {
  const analysis = analyzeStore(store);
  const importable = structuredClone(analysis.importable);
  const userIds = new Set((importable.users ?? []).map((user) => user.id));
  const dropped = {};
  let blocking = analysis.blocking;
  const dropOrphans = (flag, collection, field) => {
    if (!flags.has(flag)) return;
    const before = importable[field] ?? [];
    importable[field] = before.filter((item) => userIds.has(item.userId));
    dropped[field] = before.length - importable[field].length;
    blocking = blocking.filter((item) => !(item.kind === "orphan-user" && item.collection === collection));
  };
  dropOrphans("drop-orphan-sessions", "sessions", "sessions");
  dropOrphans("drop-orphan-account-tokens", "accountTokens", "accountTokens");
  // Postgres JSONB cannot store the NUL character; find it before importing.
  if (JSON.stringify(store).includes("\\u0000")) {
    blocking = [...blocking, { kind: "nul-character", collection: "(any)", count: 1, examples: [] }];
  }

  // Analytics: the separate document if supplied, else the copy in the store.
  const platformAnalytics = analyticsDocument?.platformAnalytics ?? store.platformAnalytics ?? null;
  const providerAnalytics = analyticsDocument?.providerAnalytics ?? store.providerAnalytics ?? {};
  return { analysis, importable, dropped, blocking, analytics: { platformAnalytics, providerAnalytics } };
}

function report(label, value) {
  console.log(`${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
}

function printPlan(source, result) {
  report("source sha256", source.sha256);
  report("counts", result.analysis.counts);
  report("ignored (already invisible to the app; not imported)", result.analysis.ignored);
  report("dropped by explicit flag", result.dropped);
  report("blocking", result.blocking);
}

async function withClient(url, work) {
  if (!url) throw new UsageError("--database-url is required");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Compares the database with the import plan. Returns the mismatching parts. */
async function reconcile(client, result) {
  const snapshot = await loadSnapshot(client, true);
  const mismatches = reconcileStores(result.importable, snapshot.store);
  if (!sameJson(result.analytics.platformAnalytics ?? null, snapshot.platformAnalytics ?? null)) {
    mismatches.push("platformAnalytics");
  }
  if (!sameJson(result.analytics.providerAnalytics ?? {}, snapshot.providerAnalytics ?? {})) {
    mismatches.push("providerAnalytics");
  }
  return { mismatches, snapshot };
}

async function importInto(client, source, result) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('statement_timeout', '120s', true)");
    // Same lock as the application: no request can write while importing.
    await client.query("SELECT pg_advisory_xact_lock($1)", [STORE_ADVISORY_LOCK_KEY]);
    const marker = await client.query("SELECT value FROM platform_meta WHERE key = 'data_source'");
    if (marker.rowCount) {
      const existing = marker.rows[0].value;
      await client.query("ROLLBACK");
      if (existing.kind === "import" && existing.sourceSha256 === source.sha256) {
        return { status: "already-imported", marker: existing };
      }
      throw new Error(
        `Refusing to import: the database already has data from ${existing.kind}` +
          (existing.sourceSha256 ? ` (source sha256 ${existing.sourceSha256})` : "") +
          ". Nothing was changed."
      );
    }
    const tables = await client.query(
      `SELECT 'x' FROM users UNION ALL SELECT 'x' FROM sessions UNION ALL SELECT 'x' FROM conversations
       UNION ALL SELECT 'x' FROM provider_profiles UNION ALL SELECT 'x' FROM uploads
       UNION ALL SELECT 'x' FROM platform_analytics UNION ALL SELECT 'x' FROM provider_analytics LIMIT 1`
    );
    if (tables.rowCount) {
      throw new Error("Refusing to import into a database that already contains records. Nothing was changed.");
    }
    await insertWholeStore(client, result.importable, result.analytics);
    const { mismatches } = await reconcile(client, result);
    if (mismatches.length) {
      throw new Error(`Reconciliation failed for: ${mismatches.join(", ")}. The import was rolled back.`);
    }
    const markerValue = {
      kind: "import",
      sourceSha256: source.sha256,
      importedAt: new Date().toISOString(),
      counts: result.analysis.counts,
      ignored: result.analysis.ignored.map(({ kind, collection, count }) => ({ kind, collection, count })),
      dropped: result.dropped,
    };
    await client.query("INSERT INTO platform_meta (key, value) VALUES ('data_source', $1::jsonb)", [
      JSON.stringify(markerValue),
    ]);
    await client.query("COMMIT");
    return { status: "imported", marker: markerValue };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function dryRun(source, result) {
  let startPostgres;
  try {
    ({ startPostgres } = await import(pathToFileURL(path.join(process.cwd(), "scripts", "test-support", "postgres.mjs")).href));
  } catch {
    throw new Error("dry-run needs the embedded-postgres dev dependency (npm install).");
  }
  const db = await startPostgres({ database: "kidcellence_dry_run" });
  try {
    return await withClient(db.url, async (client) => {
      const first = await importInto(client, source, result);
      const second = await importInto(client, source, result); // must be a no-op
      const counts = await client.query(
        `SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM sessions)::int AS sessions,
                (SELECT count(*) FROM conversations)::int AS conversations, (SELECT count(*) FROM messages)::int AS messages,
                (SELECT count(*) FROM provider_profiles)::int AS provider_profiles, (SELECT count(*) FROM uploads)::int AS uploads`
      );
      return { first: first.status, second: second.status, counts: counts.rows[0] };
    });
  } finally {
    await db.stop(); // deletes the temporary data directory
  }
}

/** Database -> legacy JSON document, for rolling back to the previous release. */
async function exportStore(url, out) {
  if (!out) throw new UsageError("--out is required");
  const document = await withClient(url, async (client) => {
    const snapshot = await loadSnapshot(client, true);
    return {
      ...snapshot.store,
      platformAnalytics: snapshot.platformAnalytics ?? undefined,
      providerAnalytics: snapshot.providerAnalytics,
    };
  });
  const text = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(out, text, { mode: 0o600, flag: "wx" });
  report("written", out);
  report("sha256", createHash("sha256").update(text).digest("hex"));
  report("users", document.users.length);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "export") return exportStore(options["database-url"], options.out);
  if (!["analyze", "dry-run", "import", "verify"].includes(command)) {
    throw new UsageError("Commands: analyze, dry-run, import, verify, export");
  }
  const source = await readSource(options);
  const result = plan(source, options.flags);
  printPlan(source, result);
  if (result.blocking.length) {
    console.error("\nBLOCKED: resolve the blocking issues above (see the runbook). Nothing was imported.");
    process.exitCode = 2;
    return;
  }
  if (command === "analyze") return;
  if (command === "dry-run") {
    report("dry run", await dryRun(source, result));
    return;
  }
  if (command === "verify") {
    const { mismatches, snapshot } = await withClient(options["database-url"], (client) => reconcile(client, result));
    report("data source marker", snapshot.dataSource);
    if (mismatches.length) {
      console.error(`MISMATCH in: ${mismatches.join(", ")}`);
      process.exitCode = 3;
    } else {
      report("verify", "database matches the source exactly");
    }
    return;
  }
  // import
  if (options["expect-sha256"] !== source.sha256) {
    throw new UsageError("--expect-sha256 must equal the source sha256 printed by analyze/dry-run.");
  }
  const outcome = await withClient(options["database-url"], (client) => importInto(client, source, result));
  report("import", outcome.status);
  report("marker", outcome.marker);
}

main().catch((error) => {
  console.error(error instanceof UsageError ? `Usage: ${error.message}` : `FAILED: ${error.message}`);
  process.exitCode = error instanceof UsageError ? 64 : 1;
});
