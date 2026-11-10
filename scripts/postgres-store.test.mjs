// Store-level tests against a real PostgreSQL server (see test-support/postgres.mjs).
// They call lib/platform-store.ts directly, in this process and in separate
// worker processes that stand in for separate serverless instances.
//
// Run: node --import ./scripts/test-support/register-alias.mjs --test scripts/postgres-store.test.mjs
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import pg from "pg";
import { applyMigrations, startPostgres } from "./test-support/postgres.mjs";

const exec = promisify(execFile);
const libUrl = (name) => pathToFileURL(path.join(process.cwd(), "lib", name)).href;

let db;
let store;
let driver;
let databaseCounter = 0;

/** Points the store at a fresh, migrated database. */
async function useFreshDatabase({ allowEmptyInit = true, migrate = true } = {}) {
  databaseCounter += 1;
  const url = await db.createDatabase(`store_test_${databaseCounter}`, { migrate });
  process.env.PLATFORM_DATABASE_URL = url;
  if (allowEmptyInit) process.env.PLATFORM_DATABASE_ALLOW_EMPTY_INIT = "true";
  else delete process.env.PLATFORM_DATABASE_ALLOW_EMPTY_INIT;
  return url;
}

async function sql(text, values) {
  const client = new pg.Client({ connectionString: process.env.PLATFORM_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows;
  } finally {
    await client.end();
  }
}

const signup = (email, extra = {}) =>
  store.createOrLoginUser({ mode: "signup", role: "parent", email, password: "synthetic-password-1", ...extra });

async function runWorkers(tasks) {
  const startAt = Date.now() + 2_500;
  const outputs = await Promise.all(
    tasks.map((task, worker) =>
      exec(
        process.execPath,
        [
          "--import",
          "./scripts/test-support/register-alias.mjs",
          "scripts/test-support/store-worker.mjs",
          JSON.stringify({ ...task, worker, startAt }),
        ],
        { env: { ...process.env }, maxBuffer: 16 * 1024 * 1024 }
      )
    )
  );
  return outputs.flatMap(({ stdout }) =>
    stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  );
}

/** A parent and an unpublished provider listing, as the role-switch flow creates them. */
async function messagingFixture(prefix) {
  const { user: provider } = await signup(`${prefix}-provider@example.invalid`);
  await store.switchActiveRole(provider.id, "provider");
  const { user: parent } = await signup(`${prefix}-parent@example.invalid`);
  return { parentUserId: parent.id, providerUserId: provider.id, providerId: `account-${provider.id}` };
}

before(async () => {
  db = await startPostgres({ migrate: false });
  process.env.PLATFORM_DATABASE_LOCK_TIMEOUT = "1500ms";
  store = await import(libUrl("platform-store.ts"));
  driver = await import(libUrl("store-postgres.ts"));
});

after(async () => {
  await driver?.closeDatabasePool();
  await db?.stop();
});

describe("schema", () => {
  it("applies the migrations idempotently", async () => {
    const url = await useFreshDatabase();
    await applyMigrations(url); // second application must be a no-op
    const tables = await sql(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"
    );
    assert.equal(tables[0].n, 15);
  });

  it("enforces unique emails, valid roles and the session-to-user foreign key", async () => {
    await useFreshDatabase();
    const user = (id, email, role = "parent") => JSON.stringify({ id, email, role, name: id, passwordHash: "x", createdAt: "2026-01-01" });
    await sql("INSERT INTO users (id, data) VALUES ('u1', $1::jsonb)", [user("u1", "Same@Example.invalid")]);
    await assert.rejects(
      sql("INSERT INTO users (id, data) VALUES ('u2', $1::jsonb)", [user("u2", " same@example.invalid ")]),
      /users_email_normalized_key/
    );
    await assert.rejects(
      sql("INSERT INTO users (id, data) VALUES ('u3', $1::jsonb)", [user("u3", "x@example.invalid", "owner")]),
      /users_role_valid/
    );
    await assert.rejects(
      sql("INSERT INTO sessions (token, data) VALUES ('t1', $1::jsonb)", [
        JSON.stringify({ token: "t1", userId: "missing", role: "parent" }),
      ]),
      /sessions_user_fk/
    );
    await assert.rejects(
      sql("INSERT INTO messages (conversation_id, id, data) VALUES ('nope', 'm1', $1::jsonb)", [
        JSON.stringify({ id: "m1", senderId: "u1", text: "hi" }),
      ]),
      /messages_conversation_fk/
    );
  });
});

describe("initialisation gate", () => {
  it("refuses to serve or accept writes on a database that was never imported", async () => {
    await useFreshDatabase({ allowEmptyInit: false });
    await assert.rejects(store.readStore(), (error) => error.code === "STORE_UNAVAILABLE" && /migration/.test(error.message));
    await assert.rejects(signup("gate@example.invalid"), (error) => error.code === "STORE_UNAVAILABLE");
    await assert.rejects(store.recordPlatformPageView({ visitorId: "v", pathname: "/" }), (error) => error.code === "STORE_UNAVAILABLE");
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, 0);
    assert.equal((await sql("SELECT count(*)::int AS n FROM platform_meta"))[0].n, 0);
  });

  it("never self-initialises in the production context, even if allowed by mistake", async () => {
    await useFreshDatabase({ allowEmptyInit: true });
    process.env.CONTEXT = "production";
    try {
      await assert.rejects(store.readStore(), (error) => error.code === "STORE_UNAVAILABLE");
    } finally {
      delete process.env.CONTEXT;
    }
    process.env.PLATFORM_BLOB_STORE_ALLOW_PRODUCTION = "true";
    try {
      await assert.rejects(store.readStore(), (error) => error.code === "STORE_UNAVAILABLE");
    } finally {
      delete process.env.PLATFORM_BLOB_STORE_ALLOW_PRODUCTION;
    }
    assert.equal((await sql("SELECT count(*)::int AS n FROM platform_meta"))[0].n, 0);
  });

  it("refuses to initialise over partially imported data", async () => {
    await useFreshDatabase({ allowEmptyInit: true });
    await sql("INSERT INTO uploads (id, data) VALUES ('up1', $1::jsonb)", [
      JSON.stringify({ id: "up1", userId: "u", type: "document" }),
    ]);
    await assert.rejects(store.readStore(), (error) => error.code === "STORE_UNAVAILABLE");
  });

  it("initialises an empty non-production database exactly once under concurrency", async () => {
    await useFreshDatabase({ allowEmptyInit: true });
    await Promise.all(Array.from({ length: 10 }, () => store.readStore()));
    const markers = await sql("SELECT value FROM platform_meta WHERE key = 'data_source'");
    assert.equal(markers.length, 1);
    assert.equal(markers[0].value.kind, "empty");
  });
});

describe("serialised writes (no lost updates)", () => {
  it("control: an unlocked read-modify-write on Postgres does lose updates", async () => {
    // Shows the concurrency tests below are sensitive to the bug they guard.
    await useFreshDatabase();
    await sql("INSERT INTO platform_meta (key, value) VALUES ('counter', '0'::jsonb)");
    const naiveIncrement = async () => {
      const client = new pg.Client({ connectionString: process.env.PLATFORM_DATABASE_URL });
      await client.connect();
      const { rows } = await client.query("SELECT value FROM platform_meta WHERE key = 'counter'");
      await new Promise((resolve) => setTimeout(resolve, 20));
      await client.query("UPDATE platform_meta SET value = $1::jsonb WHERE key = 'counter'", [
        JSON.stringify(Number(rows[0].value) + 1),
      ]);
      await client.end();
    };
    await Promise.all(Array.from({ length: 20 }, naiveIncrement));
    const [{ value }] = await sql("SELECT value FROM platform_meta WHERE key = 'counter'");
    assert.ok(Number(value) < 20, `expected lost updates without the lock, got ${value}`);
  });

  it("keeps every account when 4 processes and this one sign up simultaneously", async () => {
    await useFreshDatabase();
    await store.readStore(); // initialise before the race
    const prefix = `race-${Date.now()}`;
    const [workerResults, localResults] = await Promise.all([
      runWorkers(Array.from({ length: 4 }, () => ({ op: "signup", count: 20, prefix }))),
      Promise.all(Array.from({ length: 20 }, (_, i) => signup(`${prefix}-local-${i}@example.invalid`))),
    ]);
    const failures = workerResults.filter((result) => !result.ok);
    assert.deepEqual(failures, []);
    const acknowledged = [...workerResults.map((r) => r.value.email), ...localResults.map((r) => r.user.email)];
    assert.equal(acknowledged.length, 100);
    const rows = await sql("SELECT email_normalized FROM users WHERE email_normalized LIKE $1", [`${prefix}%`]);
    const stored = new Set(rows.map((row) => row.email_normalized));
    assert.equal(rows.length, 100, "every acknowledged account is stored exactly once");
    for (const email of acknowledged) assert.ok(stored.has(email.toLowerCase()), `${email} was lost`);
    const sessions = await sql(
      "SELECT count(*)::int AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email_normalized LIKE $1",
      [`${prefix}%`]
    );
    assert.equal(sessions[0].n, 100, "every sign-up kept its session");
  });

  it("keeps every message, in one conversation, with analytics committed alongside", async () => {
    await useFreshDatabase();
    const prefix = `msg-${Date.now()}`;
    const fixture = await messagingFixture(prefix);
    const first = await store.appendConversationMessage({
      viewerUserId: fixture.parentUserId,
      viewerRole: "parent",
      providerId: fixture.providerId,
      text: `${prefix} start`,
    });
    assert.ok(first.conversation);
    const [workerResults, localResults] = await Promise.all([
      runWorkers(Array.from({ length: 3 }, () => ({ op: "message", count: 15, prefix, ...fixture }))),
      Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          store.appendConversationMessage({
            viewerUserId: fixture.parentUserId,
            viewerRole: "parent",
            conversationId: first.conversation.id,
            text: `${prefix} local m${i}`,
          })
        )
      ),
    ]);
    assert.deepEqual(workerResults.filter((r) => !r.ok), []);
    const acknowledged = [
      `${prefix} start`,
      ...workerResults.map((r) => r.value.text),
      ...localResults.map((r) => r.message.text),
    ];
    assert.equal(acknowledged.length, 61);
    const rows = await sql("SELECT data->>'text' AS text FROM messages WHERE conversation_id = $1", [first.conversation.id]);
    assert.equal(rows.length, 61, "exactly the acknowledged messages are stored");
    assert.deepEqual(rows.map((r) => r.text).sort(), acknowledged.sort());
    assert.equal((await sql("SELECT count(*)::int AS n FROM conversations"))[0].n, 1, "one conversation");
    const [conversation] = await sql("SELECT data FROM conversations WHERE id = $1", [first.conversation.id]);
    assert.equal(conversation.data.unreadForProvider, 61, "the shared unread counter lost no increments");
    const [analytics] = await sql("SELECT data FROM provider_analytics WHERE user_id = $1", [fixture.providerUserId]);
    assert.equal(analytics.data.messagesReceived, 61, "analytics match the stored messages exactly");
    assert.equal(analytics.data.enquiries, 1);
  });

  it("preserves an admin approval made while the provider saves their profile 20 times", async () => {
    await useFreshDatabase();
    const { user } = await signup(`approval-${Date.now()}@example.invalid`);
    await store.switchActiveRole(user.id, "provider");
    const current = (await store.readStore()).providerProfiles[user.id];
    await store.saveProviderProfile(user.id, { ...current, displayName: "Approval Nursery" });
    await store.updateStore((s) => {
      s.verifications.pendingProviders.unshift({
        id: `provider-${user.id}`,
        userId: user.id,
        name: "Approval Nursery",
        category: "Nurseries",
        location: "Gaborone",
        submittedDate: "2026-11-10",
        documents: [],
        image: "",
        status: "pending",
      });
      s.providerProfiles[user.id].verificationStatus = "pending";
    });
    const staleProfile = (await store.readStore()).providerProfiles[user.id];
    await Promise.all([
      ...Array.from({ length: 20 }, (_, i) =>
        store.saveProviderProfile(user.id, { ...staleProfile, bio: `edit ${i}` })
      ),
      store.decideVerification(`provider-${user.id}`, "approve"),
    ]);
    const after = (await store.readStore()).providerProfiles[user.id];
    assert.equal(after.verificationStatus, "approved");
    assert.match(after.bio, /^edit \d+$/);
  });
});

describe("idempotency", () => {
  it("stores a retried message once when the same clientMessageId is sent 10 times at once", async () => {
    await useFreshDatabase();
    const fixture = await messagingFixture(`idem-${Date.now()}`);
    const sends = await Promise.all(
      Array.from({ length: 10 }, () =>
        store.appendConversationMessage({
          viewerUserId: fixture.parentUserId,
          viewerRole: "parent",
          providerId: fixture.providerId,
          text: "only once",
          clientMessageId: "client-msg-1",
        })
      )
    );
    assert.equal(new Set(sends.map((s) => s.message.id)).size, 1, "every retry returns the same message");
    assert.equal((await sql("SELECT count(*)::int AS n FROM messages"))[0].n, 1);
    const [analytics] = await sql("SELECT data FROM provider_analytics WHERE user_id = $1", [fixture.providerUserId]);
    assert.equal(analytics.data.messagesReceived, 1, "a retry is not counted twice");
  });

  it("treats a repeated sign-up as a login and never creates a second account", async () => {
    await useFreshDatabase();
    const email = `dup-${Date.now()}@example.invalid`;
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => signup(email)));
    const ids = new Set(results.filter((r) => r.status === "fulfilled").map((r) => r.value.user.id));
    assert.equal(ids.size, 1);
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, 1);
    await assert.rejects(
      store.createOrLoginUser({ mode: "signup", role: "parent", email, password: "a-different-password" }),
      /already exists/
    );
  });

  it("records a verification payment once, however often it is called", async () => {
    await useFreshDatabase();
    const { user } = await signup(`pay-${Date.now()}@example.invalid`, { category: "schools" });
    await store.switchActiveRole(user.id, "provider");
    const results = await Promise.all(Array.from({ length: 6 }, () => store.recordVerificationPayment(user.id)));
    assert.equal(new Set(results.map((r) => r.reference)).size, 1, "one payment reference");
    assert.equal(new Set(results.map((r) => r.paidAt)).size, 1, "one payment time");
    const again = await store.recordVerificationPayment(user.id);
    assert.equal(again.reference, results[0].reference);
  });
});

describe("failures roll back and are reported", () => {
  it("persists nothing when an updater throws after mutating", async () => {
    await useFreshDatabase();
    await store.readStore();
    await assert.rejects(
      store.updateStore((s) => {
        s.users.unshift({ id: "half", role: "parent", name: "Half", email: "half@example.invalid", passwordHash: "x", createdAt: "2026-01-01" });
        throw new Error("validation failed");
      }),
      /validation failed/
    );
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, 0);
  });

  it("rolls back every change in a transaction when one row violates a constraint", async () => {
    await useFreshDatabase();
    await signup(`taken-${Date.now()}@example.invalid`);
    const [{ n: before }] = await sql("SELECT count(*)::int AS n FROM users");
    await assert.rejects(
      store.updateStore((s) => {
        const existing = s.users[0];
        s.users.unshift({ ...existing, id: "fresh-ok", email: "fresh@example.invalid" });
        s.users.unshift({ ...existing, id: "clash", email: existing.email.toUpperCase() });
      }),
      (error) => error.code === "STORE_INTEGRITY"
    );
    const [{ n: afterCount }] = await sql("SELECT count(*)::int AS n FROM users");
    assert.equal(afterCount, before, "the valid row in the same transaction was rolled back too");
  });

  it("answers busy, and writes nothing, when the store lock cannot be acquired in time", async () => {
    await useFreshDatabase();
    await store.readStore();
    const holder = new pg.Client({ connectionString: process.env.PLATFORM_DATABASE_URL });
    await holder.connect();
    await holder.query("BEGIN");
    await holder.query("SELECT pg_advisory_xact_lock($1)", [driver.STORE_ADVISORY_LOCK_KEY]);
    try {
      await assert.rejects(signup(`busy-${Date.now()}@example.invalid`), (error) => error.code === "STORE_BUSY");
    } finally {
      await holder.query("ROLLBACK");
      await holder.end();
    }
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, 0);
    await signup(`after-busy-${Date.now()}@example.invalid`);
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, 1);
  });

  it("reports a connection killed mid-transaction as unavailable and keeps nothing", async () => {
    await useFreshDatabase();
    await store.readStore();
    const pending = store.updateStore(async (s) => {
      s.users.unshift({ id: "doomed", role: "parent", name: "D", email: "doomed@example.invalid", passwordHash: "x", createdAt: "2026-01-01" });
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await sql(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state LIKE 'idle in transaction%'"
    );
    await assert.rejects(pending, (error) => error.code === "STORE_UNAVAILABLE");
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, 0);
    await signup(`recovered-${Date.now()}@example.invalid`);
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, 1, "the pool recovers");
  });

  it("fails fast with unavailable while the database is down, then recovers with data intact", async () => {
    await useFreshDatabase();
    await signup(`before-outage-${Date.now()}@example.invalid`);
    await db.pause();
    try {
      const started = Date.now();
      await assert.rejects(signup(`during-outage-${Date.now()}@example.invalid`), (error) => error.code === "STORE_UNAVAILABLE");
      await assert.rejects(store.readStore(), (error) => error.code === "STORE_UNAVAILABLE");
      await assert.rejects(
        store.recordPlatformPageView({ visitorId: "outage", pathname: "/" }),
        (error) => error.code === "STORE_UNAVAILABLE"
      );
      assert.ok(Date.now() - started < 20_000, "outage errors are prompt");
    } finally {
      await db.resume();
    }
    await signup(`after-outage-${Date.now()}@example.invalid`);
    const emails = (await sql("SELECT email_normalized FROM users")).map((r) => r.email_normalized);
    assert.equal(emails.length, 2);
    assert.ok(emails.some((e) => e.startsWith("before-outage")));
    assert.ok(!emails.some((e) => e.startsWith("during-outage")), "nothing from the outage was half-saved");
  });

  it("does not save a message when its analytics cannot be saved (one transaction)", async () => {
    await useFreshDatabase();
    const fixture = await messagingFixture(`atomic-${Date.now()}`);
    await sql(`CREATE FUNCTION refuse_analytics() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'analytics write refused for test'; END $$`);
    await sql("CREATE TRIGGER refuse BEFORE INSERT OR UPDATE ON provider_analytics FOR EACH ROW EXECUTE FUNCTION refuse_analytics()");
    await assert.rejects(
      store.appendConversationMessage({
        viewerUserId: fixture.parentUserId,
        viewerRole: "parent",
        providerId: fixture.providerId,
        text: "must not persist alone",
      }),
      (error) => error.code === "STORE_UNAVAILABLE"
    );
    assert.equal((await sql("SELECT count(*)::int AS n FROM messages"))[0].n, 0);
    assert.equal((await sql("SELECT count(*)::int AS n FROM conversations"))[0].n, 0);
  });
});

describe("analytics", () => {
  it("counts 150 simultaneous page views from 3 processes exactly", async () => {
    await useFreshDatabase();
    await store.readStore();
    const prefix = `pv-${Date.now()}`;
    const [workerResults] = await Promise.all([
      runWorkers(Array.from({ length: 2 }, () => ({ op: "pageview", count: 50, prefix, pathname: "/burst" }))),
      Promise.all(Array.from({ length: 50 }, (_, i) => store.recordPlatformPageView({ visitorId: `${prefix}-l${i}`, pathname: "/burst" }))),
    ]);
    assert.deepEqual(workerResults.filter((r) => !r.ok), []);
    const analytics = (await store.readStore()).platformAnalytics;
    assert.equal(analytics.pageViews, 150);
    assert.equal(analytics.pages["/burst"].pageViews, 150);
    assert.equal(analytics.visitorIds.length, 150);
  });
});

describe("ordering", () => {
  it("returns lists in the order the application keeps them", async () => {
    await useFreshDatabase();
    for (const n of [1, 2, 3]) await signup(`order-${n}@example.invalid`);
    const users = (await store.readStore()).users.map((u) => u.email);
    assert.deepEqual(users, ["order-3@example.invalid", "order-2@example.invalid", "order-1@example.invalid"]);
  });
});
