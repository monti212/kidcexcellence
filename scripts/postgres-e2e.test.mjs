// End-to-end tests of the production build on Postgres: three `next start`
// processes (separate instances with separate connection pools) share one real
// PostgreSQL server, and every acknowledged write is checked independently with
// SQL. Requires a fresh `next build` (npm run test:postgres does that first).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { freePort, startPostgres } from "./test-support/postgres.mjs";

const ADMIN_EMAIL = "e2e-admin@example.invalid";
const PASSWORD = "synthetic-password-1";
const RUN = `e2e${Date.now().toString(36)}`;

let db;
let tmpRoot;
const instances = [];

async function startInstance(name, extraEnv = {}) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(path.join("node_modules", ".bin", "next"), ["start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      ADMIN_EMAILS: ADMIN_EMAIL,
      ENABLE_DEMO_PROVIDERS: "false",
      PLATFORM_DATABASE_URL: db.url,
      PLATFORM_DATABASE_ALLOW_EMPTY_INIT: "true",
      PLATFORM_UPLOADS_DIR: path.join(tmpRoot, "uploads"),
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let logs = "";
  child.stdout.on("data", (chunk) => (logs += chunk));
  child.stderr.on("data", (chunk) => (logs += chunk));
  const instance = { name, baseUrl, child, logs: () => logs };
  instances.push(instance);
  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/`);
      await response.arrayBuffer();
      if (response.status < 500) return instance;
    } catch {
      // not listening yet
    }
    if (Date.now() - started > 60_000) throw new Error(`${name} did not start:\n${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function call(instance, pathname, { method = "GET", body, cookie, form } = {}) {
  const headers = { Origin: instance.baseUrl };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${instance.baseUrl}${pathname}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

async function outcome(response) {
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? null };
}

const signup = (instance, email, extra = {}) =>
  call(instance, "/api/auth", {
    method: "POST",
    body: { mode: "signup", role: "parent", name: "E2E", email, password: PASSWORD, location: "gaborone", ...extra },
  }).then(outcome);

async function sql(text, values) {
  const client = new pg.Client({ connectionString: db.url });
  await client.connect();
  try {
    return (await client.query(text, values)).rows;
  } finally {
    await client.end();
  }
}

/** Fails with each unexpected response, so a failure shows what the server said. */
function expectAll(results, status, label) {
  const unexpected = results.filter((result) => result.status !== status);
  assert.deepEqual(
    unexpected.map((r) => ({ status: r.status, body: r.body })),
    [],
    `${label}: ${unexpected.length} of ${results.length} were not ${status}`
  );
}

const [A, B, C] = [0, 1, 2];
const instance = (i) => instances[i];

before(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "kidcellence-e2e-"));
  db = await startPostgres();
  await Promise.all(["A", "B", "C"].map((name) => startInstance(name)));
});

after(async () => {
  for (const { child } of instances) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  await db?.stop();
  if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
});

describe("production build on Postgres, three instances", () => {
  it("serves pages and reads on every instance without writing", async () => {
    await call(instance(A), "/api/providers").then((r) => r.arrayBuffer()); // initialises the empty database
    const before = await sql(
      "SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM sessions)::int AS sessions, (SELECT max(updated_at) FROM platform_meta) AS meta"
    );
    for (const i of [A, B, C]) {
      for (const pathname of ["/", "/api/providers", "/api/compare?ids=", "/api/auth", "/api/messages"]) {
        const response = await call(instance(i), pathname);
        await response.arrayBuffer();
        assert.ok([200, 401].includes(response.status), `${pathname} on ${instance(i).name}: ${response.status}`);
      }
    }
    const afterReads = await sql(
      "SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM sessions)::int AS sessions, (SELECT max(updated_at) FROM platform_meta) AS meta"
    );
    assert.deepEqual(afterReads, before, "read-only routes wrote nothing");
  });

  it("persists every acknowledged sign-up and page view under a burst across instances", async () => {
    const emails = Array.from({ length: 60 }, (_, i) => `${RUN}-burst-${i}@example.invalid`);
    const pagePath = `/__e2e/${RUN}`;
    const [signups, views] = await Promise.all([
      Promise.all(emails.map((email, i) => signup(instance(i % 3), email))),
      Promise.all(
        Array.from({ length: 90 }, (_, i) =>
          call(instance(i % 3), "/api/analytics", { method: "POST", body: { visitorId: `${RUN}-v${i}`, pathname: pagePath } }).then(outcome)
        )
      ),
    ]);
    expectAll(signups, 200, "sign-ups");
    expectAll(views, 200, "page views");
    const stored = await sql(
      `SELECT u.email_normalized, count(s.token)::int AS sessions FROM users u LEFT JOIN sessions s ON s.user_id = u.id
       WHERE u.email_normalized LIKE $1 GROUP BY u.email_normalized`,
      [`${RUN}-burst-%`]
    );
    assert.equal(stored.length, 60, "every acknowledged sign-up is stored exactly once");
    assert.ok(stored.every((row) => row.sessions === 1), "every sign-up has its session");
    const [analytics] = await sql("SELECT data FROM platform_analytics WHERE id = 1");
    assert.equal(analytics.data.pages[pagePath].pageViews, 90, "every acknowledged page view is counted");
  });

  it("keeps a session valid on every instance and revokes it everywhere", async () => {
    const email = `${RUN}-session@example.invalid`;
    assert.equal((await signup(instance(A), email)).status, 200);
    const login = await outcome(
      await call(instance(B), "/api/auth", { method: "POST", body: { mode: "login", role: "parent", email, password: PASSWORD } })
    );
    assert.equal(login.status, 200);
    for (const i of [A, B, C]) {
      const me = await outcome(await call(instance(i), "/api/auth", { cookie: login.cookie }));
      assert.equal(me.status, 200);
      assert.equal(me.body.user.email, email);
    }
    assert.equal((await outcome(await call(instance(C), "/api/auth", { method: "DELETE", cookie: login.cookie }))).status, 200);
    assert.equal((await call(instance(A), "/api/auth", { cookie: login.cookie })).status, 401);
  });

  it("stores every acknowledged message once, with matching analytics, across instances", async () => {
    const provider = await signup(instance(A), `${RUN}-provider@example.invalid`, { name: "E2E Provider" });
    const switched = await outcome(await call(instance(B), "/api/account/role", { method: "POST", body: { target: "provider" }, cookie: provider.cookie }));
    assert.equal(switched.status, 200);
    const providerId = `account-${provider.body.user.id}`;
    const parent = await signup(instance(C), `${RUN}-sender@example.invalid`);
    const first = await outcome(
      await call(instance(A), "/api/messages", { method: "POST", cookie: parent.cookie, body: { providerId, text: `${RUN} first` } })
    );
    assert.equal(first.status, 200);
    const conversationId = first.body.conversation.id;
    const sends = await Promise.all(
      Array.from({ length: 45 }, (_, i) =>
        call(instance(i % 3), "/api/messages", {
          method: "POST",
          cookie: parent.cookie,
          body: { conversationId, providerId, text: `${RUN} m${i}` },
        }).then(outcome)
      )
    );
    expectAll(sends, 200, "messages");
    const stored = await sql("SELECT data->>'text' AS text FROM messages WHERE conversation_id = $1", [conversationId]);
    assert.equal(stored.length, 46);
    assert.deepEqual(
      stored.map((r) => r.text).sort(),
      [`${RUN} first`, ...Array.from({ length: 45 }, (_, i) => `${RUN} m${i}`)].sort()
    );
    const [analytics] = await sql("SELECT data FROM provider_analytics WHERE user_id = $1", [provider.body.user.id]);
    assert.equal(analytics.data.messagesReceived, 46);
    assert.equal(analytics.data.enquiries, 1);
    const [conversation] = await sql("SELECT data FROM conversations WHERE id = $1", [conversationId]);
    assert.equal(conversation.data.unreadForProvider, 46, "the shared unread counter lost no increments");

    // The same client id sent 9 times at once, across instances, is stored once.
    const retries = await Promise.all(
      Array.from({ length: 9 }, (_, i) =>
        call(instance(i % 3), "/api/messages", {
          method: "POST",
          cookie: parent.cookie,
          body: { conversationId, providerId, text: `${RUN} retried`, clientMessageId: `${RUN}-retry-1` },
        }).then(outcome)
      )
    );
    expectAll(retries, 200, "retried send");
    assert.equal(new Set(retries.map((r) => r.body.message.id)).size, 1);
    const copies = await sql("SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND data->>'text' = $2", [
      conversationId,
      `${RUN} retried`,
    ]);
    assert.equal(copies[0].n, 1);
  });

  it("preserves an admin approval made during 15 concurrent profile saves", async () => {
    const providerSignup = await signup(instance(A), `${RUN}-nursery@example.invalid`, { role: "provider", name: "E2E Nursery", category: "nurseries" });
    assert.equal(providerSignup.status, 200);
    const cookie = providerSignup.cookie;
    const userId = providerSignup.body.user.id;
    const profile = {
      displayName: "E2E Nursery", category: "nurseries", location: "Gaborone", bio: "A nurturing early learning programme.",
      phone: "+267 71 000 333", whatsapp: "+26771000333", services: ["Reception"], experience: "Ten years", availability: "Weekdays",
      price: "4000", priceUnit: "termly", mission: "Help children grow.", vision: "A trusted community.", values: "Safety and care.",
      published: true, liveIn: true, feeRows: [{ grade: "Reception", termly: "4000", annually: "12000" }],
    };
    assert.equal((await call(instance(B), "/api/profiles/provider", { method: "POST", cookie, body: { profile } })).status, 200);
    assert.equal((await call(instance(C), "/api/verifications/payment", { method: "POST", cookie })).status, 200);
    const files = [
      ...["profile-image", "cover-image", "gallery"].map((type) => ({ type, contentType: "image/png", name: `${type}.png` })),
      ...["registration-certificate", "operating-documentation", "prospectus", "representative-id"].map((documentKey) => ({
        type: "document", documentKey, contentType: "application/pdf", name: `${documentKey}.pdf`,
      })),
    ];
    for (const [i, file] of files.entries()) {
      const form = new FormData();
      form.set("type", file.type);
      if (file.documentKey) form.set("documentKey", file.documentKey);
      form.set("label", file.documentKey ?? file.type);
      form.set("file", new Blob([`synthetic ${file.name}`], { type: file.contentType }), file.name);
      const upload = await call(instance(i % 3), "/api/uploads", { method: "POST", cookie, form });
      assert.equal(upload.status, 200, `upload ${file.name}: ${await upload.text()}`);
    }
    const submitted = await outcome(await call(instance(A), "/api/verifications", { method: "POST", cookie }));
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const admin = await outcome(
      await call(instance(B), "/api/auth", { method: "POST", body: { mode: "login", role: "admin", email: ADMIN_EMAIL, password: PASSWORD } })
    );
    assert.equal(admin.status, 200);
    const queue = await outcome(await call(instance(C), "/api/admin/verifications", { cookie: admin.cookie }));
    const submission = queue.body.pendingProviders.find((item) => item.userId === userId);
    assert.ok(submission, "submission is pending");
    const results = await Promise.all([
      ...Array.from({ length: 15 }, (_, i) =>
        call(instance(i % 3), "/api/profiles/provider", { method: "POST", cookie, body: { profile: { ...profile, bio: `edit ${i}` } } }).then(outcome)
      ),
      call(instance(A), "/api/admin/verifications", { method: "PATCH", cookie: admin.cookie, body: { id: submission.id, action: "approve" } }).then(outcome),
    ]);
    expectAll(results, 200, "saves and approval");
    const [row] = await sql("SELECT verification_status FROM provider_profiles WHERE user_id = $1", [userId]);
    assert.equal(row.verification_status, "approved");
  });

  it("answers 503, never 200, while the database is down, and loses nothing", async () => {
    const before = (await sql("SELECT count(*)::int AS n FROM users"))[0].n;
    await db.pause();
    try {
      const during = await Promise.all([
        signup(instance(A), `${RUN}-outage-a@example.invalid`),
        signup(instance(B), `${RUN}-outage-b@example.invalid`),
        call(instance(C), "/api/analytics", { method: "POST", body: { visitorId: `${RUN}-outage`, pathname: "/" } }).then(outcome),
        call(instance(A), "/api/providers").then(outcome),
      ]);
      for (const result of during) {
        assert.equal(result.status, 503, JSON.stringify(result.body));
        assert.equal(result.body.code, "STORE_UNAVAILABLE");
      }
    } finally {
      await db.resume();
    }
    const recovered = await signup(instance(C), `${RUN}-after-outage@example.invalid`);
    assert.equal(recovered.status, 200);
    const users = await sql("SELECT email_normalized FROM users WHERE email_normalized LIKE $1", [`${RUN}-%outage%`]);
    assert.deepEqual(users.map((u) => u.email_normalized), [`${RUN}-after-outage@example.invalid`]);
    assert.equal((await sql("SELECT count(*)::int AS n FROM users"))[0].n, before + 1);
  });

  it("serves 503 (maintenance) from a database that has not been imported yet", async () => {
    const url = await db.createDatabase(`e2e_unimported_${Date.now()}`);
    const gated = await startInstance("D", { PLATFORM_DATABASE_URL: url, PLATFORM_DATABASE_ALLOW_EMPTY_INIT: "false" });
    const results = await Promise.all([
      call(gated, "/api/providers").then(outcome),
      signup(gated, `${RUN}-gated@example.invalid`),
    ]);
    for (const result of results) {
      assert.equal(result.status, 503);
      assert.match(result.body.error, /migration/);
    }
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const { rows } = await client.query("SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM platform_meta)::int AS meta");
    await client.end();
    assert.deepEqual(rows[0], { users: 0, meta: 0 });
  });
});
