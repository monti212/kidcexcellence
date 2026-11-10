#!/usr/bin/env node
// Concurrency verification against a DEPLOYED preview backed by Netlify Database.
//
//   node scripts/verify-deployed-concurrency.mjs \
//     --target https://deploy-preview-<n>--kidcexcellence-app.netlify.app \
//     --preview-database-url "$(netlify database status --branch <preview branch> --show-credentials --json | jq -r ...)" \
//     --production-database-url "<production branch connection string>" \
//     --confirm
//
// Writes ONLY synthetic records (@example.invalid accounts, marked messages)
// through the preview's public API, then verifies each acknowledged write
// directly in the preview database branch. The production database is only
// read (row counts and newest update time) before and after, to prove the run
// did not reach it. Refuses to start unless the preview and production
// connection strings point at different databases.
//
// --allow-local lets the script run against http://127.0.0.1 for testing the
// script itself; never use it for a deployed check.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const flag = (name) => args.includes(`--${name}`);

const target = option("target");
const previewUrl = option("preview-database-url");
const productionUrl = option("production-database-url");
const SIGNUPS = Number(option("signups") ?? 30);
const PAGE_VIEWS = Number(option("page-views") ?? 60);
// One user may send 30 messages a minute per instance: 1 + MESSAGES + 6 retries must stay below it.
const MESSAGES = Number(option("messages") ?? 20);
const RUN = `kcverify${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const PASSWORD = randomBytes(18).toString("base64url");

function fail(message) {
  console.error(`ABORT (nothing was written): ${message}`);
  process.exit(2);
}

if (!target || !previewUrl || !productionUrl) fail("--target, --preview-database-url and --production-database-url are required");
if (!flag("confirm")) fail("--confirm is required");
const targetUrl = new URL(target);
const localTest = flag("allow-local") && ["127.0.0.1", "localhost"].includes(targetUrl.hostname);
if (!localTest && !/^deploy-preview-\d+--kidcexcellence-app\.netlify\.app$/.test(targetUrl.hostname)) {
  fail(`target ${targetUrl.hostname} is not a Kidcellence deploy preview`);
}

const connectionIdentity = (url) => {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.slice(1)}`;
};
if (connectionIdentity(previewUrl) === connectionIdentity(productionUrl)) {
  fail("the preview and production connection strings point at the same database");
}

async function query(url, text, values) {
  // TLS settings come from the connection string (Netlify includes sslmode).
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text, values)).rows;
  } finally {
    await client.end();
  }
}

const FINGERPRINT = `SELECT
  (SELECT count(*) FROM users)::int AS users,
  (SELECT count(*) FROM sessions)::int AS sessions,
  (SELECT count(*) FROM messages)::int AS messages,
  (SELECT count(*) FROM users WHERE email_normalized LIKE 'kcverify%')::int AS synthetic_users,
  GREATEST((SELECT max(updated_at) FROM users), (SELECT max(updated_at) FROM sessions),
           (SELECT max(created_at) FROM messages), (SELECT max(updated_at) FROM platform_analytics)) AS newest_write`;

function call(pathname, { method = "GET", body, cookie } = {}) {
  const headers = { Origin: targetUrl.origin };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const url = new URL(pathname, targetUrl.origin);
  assert.equal(url.origin, targetUrl.origin);
  return fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }).then(async (response) => {
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      status: response.status,
      body: json,
      cookie: response.headers.get("set-cookie")?.split(";")[0] ?? null,
      requestId: response.headers.get("x-nf-request-id"),
    };
  });
}

const tally = (results) => results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
const findings = [];
const check = (ok, label, detail = "") => {
  findings.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

// ---- Isolation and baseline (read-only) ----
const productionBefore = (await query(productionUrl, FINGERPRINT))[0];
console.log(`production before: ${JSON.stringify(productionBefore)}`);
const live = await call("/api/providers");
if (live.status !== 200) fail(`GET /api/providers returned ${live.status}`);
const previewMarker = await query(previewUrl, "SELECT value FROM platform_meta WHERE key = 'data_source'");
console.log(`preview data source: ${JSON.stringify(previewMarker[0]?.value?.kind ?? null)}`);

// ---- Burst 1: sign-ups and page views ----
const emails = Array.from({ length: SIGNUPS }, (_, i) => `${RUN}-p${i}@example.invalid`);
const pagePath = `/__verify/${RUN}`;
const [signups, views] = await Promise.all([
  Promise.all(emails.map((email) => call("/api/auth", { method: "POST", body: { mode: "signup", role: "parent", name: "SYNTHETIC", email, password: PASSWORD } }))),
  Promise.all(Array.from({ length: PAGE_VIEWS }, (_, i) => call("/api/analytics", { method: "POST", body: { visitorId: `${RUN}-v${i}`, pathname: pagePath } }))),
]);
console.log(`sign-ups ${JSON.stringify(tally(signups))}; page views ${JSON.stringify(tally(views))}`);
const ackedEmails = emails.filter((_, i) => signups[i].status === 200);
const stored = await query(previewUrl, "SELECT email_normalized FROM users WHERE email_normalized LIKE $1", [`${RUN}-p%`]);
const storedSet = new Set(stored.map((r) => r.email_normalized));
check(ackedEmails.every((e) => storedSet.has(e)), "every acknowledged sign-up is stored", `${ackedEmails.length} acknowledged, ${stored.length} stored`);
check(stored.length === ackedEmails.length, "no unacknowledged sign-up was stored, none twice");
check(signups.every((r) => [200, 503].includes(r.status)), "every sign-up was either saved (200) or explicitly refused (503)");
const [analyticsRow] = await query(previewUrl, "SELECT data FROM platform_analytics WHERE id = 1");
const ackedViews = views.filter((r) => r.status === 200).length;
const storedViews = analyticsRow?.data?.pages?.[pagePath]?.pageViews ?? 0;
check(storedViews === ackedViews, "every acknowledged page view is counted, none extra", `${ackedViews} acknowledged, ${storedViews} stored`);

// ---- Burst 2: messages in one conversation ----
const provider = await call("/api/auth", { method: "POST", body: { mode: "signup", role: "parent", name: "SYNTHETIC provider", email: `${RUN}-provider@example.invalid`, password: PASSWORD } });
const switched = await call("/api/account/role", { method: "POST", body: { target: "provider" }, cookie: provider.cookie });
assert.equal(switched.status, 200, "role switch failed");
const [profileRow] = await query(previewUrl, "SELECT published FROM provider_profiles WHERE user_id = $1", [provider.body.user.id]);
check(profileRow?.published === "false", "synthetic provider listing is unpublished");
const sender = await call("/api/auth", { method: "POST", body: { mode: "signup", role: "parent", name: "SYNTHETIC sender", email: `${RUN}-sender@example.invalid`, password: PASSWORD } });
const providerId = `account-${provider.body.user.id}`;
const first = await call("/api/messages", { method: "POST", cookie: sender.cookie, body: { providerId, text: `${RUN} first` } });
assert.equal(first.status, 200, "first message failed");
const conversationId = first.body.conversation.id;
const sends = await Promise.all(
  Array.from({ length: MESSAGES }, (_, i) =>
    call("/api/messages", { method: "POST", cookie: sender.cookie, body: { conversationId, providerId, text: `${RUN} m${i}`, clientMessageId: `${RUN}-c${i}` } })
  )
);
console.log(`messages ${JSON.stringify(tally(sends))}`);
const ackedTexts = [`${RUN} first`, ...sends.flatMap((r, i) => (r.status === 200 ? [`${RUN} m${i}`] : []))];
const storedMessages = (await query(previewUrl, "SELECT data->>'text' AS text FROM messages WHERE conversation_id = $1", [conversationId])).map((r) => r.text);
check(ackedTexts.every((t) => storedMessages.includes(t)), "every acknowledged message is stored", `${ackedTexts.length} acknowledged, ${storedMessages.length} stored`);
check(storedMessages.length === new Set(storedMessages).size && storedMessages.length === ackedTexts.length, "no message stored twice or without acknowledgement");
const [conversationRow] = await query(previewUrl, "SELECT data FROM conversations WHERE id = $1", [conversationId]);
check(conversationRow.data.unreadForProvider === ackedTexts.length, "shared unread counter lost no increments", `${conversationRow.data.unreadForProvider}`);
const [providerAnalytics] = await query(previewUrl, "SELECT data FROM provider_analytics WHERE user_id = $1", [provider.body.user.id]);
check(providerAnalytics?.data?.messagesReceived === ackedTexts.length, "provider analytics match stored messages exactly");

// Retried send: same client id, several times at once.
const retries = await Promise.all(
  Array.from({ length: 6 }, () => call("/api/messages", { method: "POST", cookie: sender.cookie, body: { conversationId, providerId, text: `${RUN} retried`, clientMessageId: `${RUN}-retry` } }))
);
const retryCopies = (await query(previewUrl, "SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND data->>'text' = $2", [conversationId, `${RUN} retried`]))[0].n;
check(retryCopies === 1 && retries.every((r) => r.status === 200), "a retried send is stored exactly once", `statuses ${JSON.stringify(tally(retries))}`);

// ---- Production untouched ----
const productionAfter = (await query(productionUrl, FINGERPRINT))[0];
console.log(`production after: ${JSON.stringify(productionAfter)}`);
check(productionAfter.synthetic_users === 0, "no synthetic account reached production");
check(
  productionAfter.messages >= productionBefore.messages && productionAfter.users >= productionBefore.users,
  "production lost nothing during the run (live traffic may add records)"
);

const failed = findings.filter((f) => !f.ok);
console.log(`\n${failed.length ? `FAILED: ${failed.length} check(s)` : "ALL CHECKS PASSED"} for ${RUN}`);
console.log("Request ids for log correlation:", JSON.stringify([...signups, ...views, ...sends].map((r) => r.requestId).filter(Boolean).slice(0, 10)), "…");
process.exit(failed.length ? 1 : 0);
