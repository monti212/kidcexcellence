// Real PostgreSQL for tests: the official server binaries shipped by the
// embedded-postgres dev dependency, in a throwaway data directory on a free
// port. Unlike an in-process emulator it accepts many concurrent connections,
// so concurrency tests exercise genuine transactions, row locks and
// advisory locks.
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

export const MIGRATIONS_DIR = path.join(process.cwd(), "netlify", "database", "migrations");

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Applies netlify/database/migrations in name order, as Netlify does. */
export async function applyMigrations(connectionString) {
  const entries = (await readdir(MIGRATIONS_DIR)).filter((name) => /^\d+_[a-z0-9_-]+(\.sql)?$/.test(name)).sort();
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const entry of entries) {
      const file = entry.endsWith(".sql")
        ? path.join(MIGRATIONS_DIR, entry)
        : path.join(MIGRATIONS_DIR, entry, "migration.sql");
      await client.query(await readFile(file, "utf8"));
    }
  } finally {
    await client.end();
  }
  return entries;
}

export async function startPostgres({ database = "kidcellence", migrate = true } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kidcellence-pg-"));
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: directory,
    port,
    user: "postgres",
    password: "postgres",
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase(database);
  const url = `postgres://postgres:postgres@127.0.0.1:${port}/${database}`;
  if (migrate) await applyMigrations(url);
  let running = true;
  return {
    url,
    port,
    directory,
    /** Stops the server but keeps its data (for outage tests). */
    async pause() {
      if (running) await server.stop();
      running = false;
    },
    async resume() {
      if (!running) await server.start();
      running = true;
    },
    async createDatabase(name, { migrate: applySchema = true } = {}) {
      await server.createDatabase(name);
      const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${port}/${name}`;
      if (applySchema) await applyMigrations(databaseUrl);
      return databaseUrl;
    },
    async query(text, values) {
      const client = new pg.Client({ connectionString: url });
      await client.connect();
      try {
        return await client.query(text, values);
      } finally {
        await client.end();
      }
    },
    async stop() {
      if (running) await server.stop().catch(() => undefined);
      running = false;
      await rm(directory, { recursive: true, force: true });
    },
  };
}
