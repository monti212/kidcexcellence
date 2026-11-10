// End-to-end regression tests for store concurrency, run against a real dev
// server with an isolated, synthetic filesystem store. Covers overlapping
// writes, analytics separation and migration, provider verification
// preservation, read-only behavior, and fail-closed corruption handling.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const port = Number(process.env.STORE_TEST_PORT ?? 3211);
const baseUrl = `http://localhost:${port}`;
const tmpRoot = await mkdtemp(path.join(tmpdir(), "kidcellence-store-test-"));
const storePath = path.join(tmpRoot, "platform-store.json");
const analyticsPath = path.join(tmpRoot, "platform-analytics.json");
const adminEmail = "store-admin@example.com";
const env = {
  ...process.env,
  ADMIN_EMAILS: adminEmail,
  ENABLE_DEMO_PROVIDERS: "false",
  PLATFORM_STORAGE_DRIVER: "filesystem",
  PLATFORM_STORE_PATH: storePath,
  PLATFORM_UPLOADS_DIR: path.join(tmpRoot, "uploads"),
};

// A store written by the previous release: analytics still inside it.
const legacyStore = {
  users: [],
  platformAnalytics: {
    pageViews: 7,
    visitorIds: ["legacy-visitor"],
    lastVisitedAt: "2026-01-01T00:00:00.000Z",
    daily: [{ date: "2026-01-01", pageViews: 7, visitorIds: ["legacy-visitor"] }],
    pages: { "/": { path: "/", pageViews: 7 } },
  },
  providerAnalytics: {},
};

let server;
const request = (pathname, options = {}) => fetch(`${baseUrl}${pathname}`, options);
const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const cookieFrom = (response) => {
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "expected set-cookie header");
  return cookie.split(";")[0];
};
const postJson = (pathname, body, cookie) =>
  request(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
const signup = (role, email, extra = {}) =>
  postJson("/api/auth", { mode: "signup", role, name: `Store ${role}`, email, password: "password123", location: "gaborone", ...extra });
// Asserts statuses and, on mismatch, shows each unexpected response body.
async function expectStatuses(responses, expected, label) {
  const actual = responses.map((r) => r.status);
  if (actual.every((status) => status === expected)) return;
  const details = await Promise.all(
    responses.map(async (r, i) => (r.status === expected ? null : `#${i} ${r.status} ${r.url} ${await r.clone().text()}`))
  );
  assert.fail(`${label}: expected all ${expected}\n${details.filter(Boolean).join("\n").slice(0, 2000)}`);
}
const pageView = (visitorId) => postJson("/api/analytics", { visitorId, pathname: "/search" });

before(async () => {
  await writeFile(storePath, `${JSON.stringify(legacyStore, null, 2)}\n`);
  server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout.on("data", (chunk) => (logs += chunk));
  server.stderr.on("data", (chunk) => (logs += chunk));
  server.on("exit", (code) => {
    if (code) process.stderr.write(logs);
  });

  const started = Date.now();
  while (Date.now() - started < 60000) {
    const ok = await request("/api/providers").then((r) => r.ok).catch(() => false);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Test server did not start. Logs:\n${logs}`);
});

after(async () => {
  if (server && !server.killed) server.kill("SIGTERM");
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("store concurrency and integrity", () => {
  const state = {};

  it("migrates legacy analytics on first write only, once, and leaves the main store's copy in place", async () => {
    await request("/api/providers");
    await assert.rejects(stat(analyticsPath), "a read must not create the analytics document");

    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => pageView(`migrate-${i}`)));
    await expectStatuses(responses, 200, "page views");

    const analytics = await readJson(analyticsPath);
    assert.equal(analytics.platformAnalytics.pageViews, 17, "7 carried over + 10 new, nothing double counted");
    assert.ok(analytics.platformAnalytics.visitorIds.includes("legacy-visitor"));
    assert.ok(analytics.migratedFromMainStoreAt);
    assert.equal((await readJson(storePath)).platformAnalytics.pageViews, 7, "legacy copy kept for rollback");
  });

  it("keeps every account when 20 sign-ups and 40 page views overlap", async () => {
    const emails = Array.from({ length: 20 }, (_, i) => `burst-${i}-${Date.now()}@example.com`);
    const responses = await Promise.all([
      ...emails.map((email) => signup("parent", email)),
      ...Array.from({ length: 40 }, (_, i) => pageView(`burst-${i}`)),
    ]);
    await expectStatuses(responses, 200, "sign-ups and page views");

    const store = await readJson(storePath);
    for (const email of emails) {
      assert.ok(store.users.some((user) => user.email === email), `${email} was lost`);
    }
    assert.equal(new Set(store.users.map((user) => user.id)).size, store.users.length, "user ids are unique");
    assert.equal((await readJson(analyticsPath)).platformAnalytics.pageViews, 57);
  });

  it("preserves an admin approval made while the provider is saving their profile", async () => {
    const providerSignup = await signup("provider", `nursery-${Date.now()}@example.com`, {
      name: "Store Nursery",
      category: "nurseries",
    });
    assert.equal(providerSignup.status, 200);
    const providerCookie = cookieFrom(providerSignup);
    const providerUserId = (await providerSignup.json()).user.id;
    const profileBody = {
      profile: {
        displayName: "Store Nursery",
        category: "nurseries",
        location: "Gaborone",
        bio: "A nurturing early learning programme.",
        phone: "+267 71 000 333",
        whatsapp: "+26771000333",
        services: ["Reception"],
        experience: "Ten years",
        availability: "Weekdays",
        price: "4000",
        priceUnit: "termly",
        mission: "Help children grow.",
        vision: "A trusted community.",
        values: "Safety and care.",
        published: true,
        liveIn: true,
        feeRows: [{ grade: "Reception", termly: "4000", annually: "12000" }],
      },
    };
    const saved = await postJson("/api/profiles/provider", profileBody, providerCookie);
    await expectStatuses([saved], 200, "initial profile save");
    state.providerCookie = providerCookie;
    state.providerPublicId = (await saved.json()).publicId;

    const payment = await request("/api/verifications/payment", {
      method: "POST",
      headers: { Cookie: providerCookie, Origin: baseUrl },
    });
    await expectStatuses([payment], 200, "payment");
    const files = [
      ...["profile-image", "cover-image", "gallery"].map((type) => ({ type, contentType: "image/png", name: `${type}.png` })),
      ...["registration-certificate", "operating-documentation", "prospectus", "representative-id"].map((documentKey) => ({
        type: "document",
        documentKey,
        contentType: "application/pdf",
        name: `${documentKey}.pdf`,
      })),
    ];
    for (const { type, documentKey, contentType, name } of files) {
      const form = new FormData();
      form.set("type", type);
      if (documentKey) form.set("documentKey", documentKey);
      form.set("label", documentKey ?? type);
      form.set("file", new Blob([`synthetic ${name}`], { type: contentType }), name);
      const upload = await request("/api/uploads", {
        method: "POST",
        headers: { Cookie: providerCookie, Origin: baseUrl },
        body: form,
      });
      await expectStatuses([upload], 200, `upload ${name}`);
    }
    const submitted = await request("/api/verifications", {
      method: "POST",
      headers: { Cookie: providerCookie, Origin: baseUrl },
    });
    await expectStatuses([submitted], 200, "verification submission");

    const adminLogin = await postJson("/api/auth", {
      mode: "login",
      role: "admin",
      email: adminEmail,
      password: "password123",
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = cookieFrom(adminLogin);
    state.adminCookie = adminCookie;
    const queue = await (await request("/api/admin/verifications", { headers: { Cookie: adminCookie } })).json();
    const submission = queue.pendingProviders.find((item) => item.name === "Store Nursery");
    assert.ok(submission, "submission is pending");

    // Each save reads the profile, then commits; the approval lands in between.
    const results = await Promise.all([
      ...Array.from({ length: 15 }, () => postJson("/api/profiles/provider", profileBody, providerCookie)),
      request("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie, Origin: baseUrl },
        body: JSON.stringify({ id: submission.id, action: "approve" }),
      }),
    ]);
    await expectStatuses(results, 200, "concurrent saves and approval");
    const store = await readJson(storePath);
    assert.equal(store.providerProfiles[providerUserId].verificationStatus, "approved");
  });

  it("keeps every message when a parent sends 15 at once, and counts them in analytics", async () => {
    const parentSignup = await signup("parent", `messenger-${Date.now()}@example.com`);
    const parentCookie = cookieFrom(parentSignup);
    state.parentCookie = parentCookie;
    const draft = await (
      await request(`/api/messages?provider=${encodeURIComponent(state.providerPublicId)}`, {
        headers: { Cookie: parentCookie },
      })
    ).json();
    const conversationId = draft.conversations[0].id;

    const sends = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        postJson("/api/messages", { conversationId, providerId: state.providerPublicId, text: `message ${i}` }, parentCookie)
      )
    );
    await expectStatuses(sends, 200, "messages");

    const inbox = await (await request("/api/messages", { headers: { Cookie: parentCookie } })).json();
    const texts = inbox.conversations[0].messages.map((message) => message.text).sort();
    assert.deepEqual(texts, Array.from({ length: 15 }, (_, i) => `message ${i}`).sort());

    const providerUserId = state.providerPublicId.replace(/^account-/, "");
    const providerAnalytics = (await readJson(analyticsPath)).providerAnalytics[providerUserId];
    assert.equal(providerAnalytics.messagesReceived, 15);
  });

  it("does not write anything while serving read-only requests", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const before = await Promise.all([stat(storePath), stat(analyticsPath)]);
    const responses = await Promise.all([
      request("/api/providers"),
      request(`/api/providers/${state.providerPublicId}`),
      request(`/api/compare?ids=${state.providerPublicId}`),
      request("/api/auth", { headers: { Cookie: state.parentCookie } }),
      request("/api/messages", { headers: { Cookie: state.parentCookie } }),
      request("/api/profiles/provider", { headers: { Cookie: state.providerCookie } }),
      request("/api/verifications", { headers: { Cookie: state.providerCookie } }),
      request("/api/admin/verifications", { headers: { Cookie: state.adminCookie } }),
      request(`/provider/${state.providerPublicId}`),
    ]);
    await expectStatuses(responses, 200, "read-only requests");
    const afterStats = await Promise.all([stat(storePath), stat(analyticsPath)]);
    assert.equal(afterStats[0].mtimeMs, before[0].mtimeMs, "main store was written by a read");
    assert.equal(afterStats[1].mtimeMs, before[1].mtimeMs, "analytics were written by a read");
  });

  it("fails closed on a corrupt main store without resetting it, then recovers after a manual restore", async () => {
    const good = await readFile(storePath, "utf8");
    const userCount = JSON.parse(good).users.length;
    const damaged = good.slice(0, Math.floor(good.length / 2));
    await writeFile(storePath, damaged);

    const failing = await Promise.all([
      request("/api/providers"),
      request("/api/auth", { headers: { Cookie: state.parentCookie } }),
      signup("parent", `during-corruption-${Date.now()}@example.com`),
    ]);
    for (const response of failing) {
      // Routes differ (some map errors to 400), but none may report success
      // or reveal server file paths.
      assert.notEqual(response.status, 200, `${response.url} succeeded on a corrupt store`);
      assert.ok(!(await response.text()).includes(tmpRoot), "error response leaks a server path");
    }
    assert.equal(await readFile(storePath, "utf8"), damaged, "the damaged store was not overwritten or reset");
    assert.ok((await readdir(tmpRoot)).some((name) => name.startsWith("platform-store.json.corrupt-")));

    await writeFile(storePath, good); // controlled manual recovery
    const recovered = await request("/api/providers");
    assert.equal(recovered.status, 200);
    assert.equal((await readJson(storePath)).users.length, userCount, "no accounts lost");
    assert.equal((await request("/api/auth", { headers: { Cookie: state.parentCookie } })).status, 200);
  });

  it("keeps accounts and messaging working when only the analytics document is corrupt", async () => {
    const good = await readFile(analyticsPath, "utf8");
    await writeFile(analyticsPath, "{ broken analytics");

    await expectStatuses(
      [await request("/api/providers"), await request("/api/messages", { headers: { Cookie: state.parentCookie } })],
      200,
      "reads with corrupt analytics"
    );
    const view = await pageView("while-analytics-corrupt");
    assert.equal(view.status, 200);
    assert.deepEqual(await view.json(), { ok: true });
    assert.equal(await readFile(analyticsPath, "utf8"), "{ broken analytics", "analytics not overwritten");
    const dashboard = await request("/api/admin/verifications", { headers: { Cookie: state.adminCookie } });
    await expectStatuses([dashboard], 200, "admin dashboard with corrupt analytics");

    await writeFile(analyticsPath, good);
  });
});
