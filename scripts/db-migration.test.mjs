// Tests for the one-time legacy-store import (scripts/db-migrate.mjs) against a
// real PostgreSQL server, using a synthetic legacy store that contains every
// awkward case the importer has to handle. No production data is involved.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import pg from "pg";
import { startPostgres } from "./test-support/postgres.mjs";

const exec = promisify(execFile);
const PASSWORD = "legacy-password-1";

function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/** A store in the legacy single-document format, with deliberate edge cases. */
function legacyStore() {
  const hash = passwordHash(PASSWORD);
  return {
    users: [
      { id: "user-3", role: "provider", roles: ["provider"], name: "Newest Provider", email: "Provider@Example.invalid", passwordHash: hash, createdAt: "2026-03-01T00:00:00.000Z", category: "nurseries" },
      { id: "user-2", role: "parent", name: "Legacy Parent", email: "parent@example.invalid", passwordHash: hash, createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "user-1", role: "admin", name: "Admin", email: "admin-legacy@example.invalid", passwordHash: hash, createdAt: "2026-01-01T00:00:00.000Z" },
    ],
    sessions: [
      { token: "tok-a", userId: "user-2", role: "parent", createdAt: "2026-02-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" },
      { token: "tok-orphan", userId: "user-lost", role: "parent", createdAt: "2026-02-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" },
    ],
    revokedSessionTokens: ["tok-old-1", "tok-old-2"],
    removedUserIds: ["user-removed"],
    accountTokens: [
      { token: "acct-1", userId: "user-2", type: "email-verification", createdAt: "2026-02-01T00:00:00.000Z", expiresAt: "2026-02-02T00:00:00.000Z" },
    ],
    parentProfiles: {
      "user-2": { fullName: "Legacy Parent", dateOfBirth: "", nationality: "", location: "Gaborone", phone: "", bio: "", children: [{ id: "c1", name: "Kid", dob: "2020-01-01", specialNeeds: "" }], savedAt: "2026-02-02T00:00:00.000Z" },
    },
    providerProfiles: {
      "user-3": { userId: "user-3", displayName: "Legacy Nursery", category: "nurseries", published: true, verificationStatus: "approved", verificationPaymentStatus: "paid", feeRows: [], savedAt: "2026-03-02T00:00:00.000Z" },
      "profile-only-9": { displayName: "Profile Only Listing", category: "schools", published: true, savedAt: "2026-01-05T00:00:00.000Z" },
    },
    providerAnalytics: {
      "user-3": { userId: "user-3", profileViews: 12, enquiries: 2, messagesReceived: 5, daily: [{ date: "2026-03-03", profileViews: 4, enquiries: 1, messagesReceived: 2 }] },
    },
    platformAnalytics: {
      pageViews: 321,
      visitorIds: ["v1", "v2"],
      lastVisitedAt: "2026-03-04T00:00:00.000Z",
      daily: [{ date: "2026-03-04", pageViews: 21, visitorIds: ["v1"] }],
      pages: { "/": { path: "/", pageViews: 300 }, "/pricing": { path: "/pricing", pageViews: 21 } },
    },
    uploads: [
      { id: "upload-2", userId: "user-3", type: "gallery", label: "Gallery photo", fileName: "b.png", contentType: "image/png", size: 10, path: "blob:uploads/user-3/upload-2-b.png", createdAt: "2026-03-02T00:00:00.000Z" },
      { id: "upload-1", userId: "user-3", type: "document", documentKey: "prospectus", label: "Prospectus", fileName: "a.pdf", contentType: "application/pdf", size: 20, path: "blob:uploads/user-3/upload-1-a.pdf", createdAt: "2026-03-01T00:00:00.000Z" },
    ],
    conversations: [
      {
        id: "conv-1", parentUserId: "user-2", parentName: "Legacy Parent", providerId: "account-user-3", providerUserId: "user-3", providerName: "Legacy Nursery",
        participant: "Legacy Nursery", participantImage: "", lastMessage: "second", timestamp: "now", unread: 1, unreadForProvider: 1, unreadForParent: 0,
        messages: [
          { id: "m1", senderId: "user-2", text: "first", timestamp: "2026-03-03T00:00:00.000Z", isOwn: true },
          { id: "m2", senderId: "user-3", text: "second ü 😀", timestamp: "2026-03-03T00:01:00.000Z", isOwn: false },
        ],
      },
      // Invisible to the app today (normalizeStore drops it): must not be imported.
      { id: "conv-legacy-demo", participant: "Demo", messages: [] },
    ],
    verifications: {
      pendingProviders: [
        { id: "provider-user-3", userId: "user-3", name: "Legacy Nursery", category: "Nurseries", location: "Gaborone", submittedDate: "2026-03-02", documents: ["Prospectus"], image: "", status: "pending" },
        { id: "seed-without-user", name: "Old seed", status: "pending" },
      ],
      approvedProviders: [
        { id: "approved-x", userId: "user-3", name: "Legacy Nursery", category: "Nurseries", verified: true, date: "2026-03-05" },
        { id: "a1", name: "Demo approval", category: "Schools", verified: true, date: "2025-01-01" },
      ],
      rejectedCount: 2,
    },
  };
}

let db;
let workdir;
let counter = 0;

async function freshDatabase() {
  counter += 1;
  return db.createDatabase(`migration_test_${counter}`);
}

async function writeSource(store, name = "store.json") {
  const file = path.join(workdir, `${counter}-${name}`);
  await writeFile(file, JSON.stringify(store, null, 2));
  return file;
}

async function migrate(args) {
  try {
    const { stdout, stderr } = await exec(process.execPath, ["scripts/db-migrate.mjs", ...args], { maxBuffer: 8 * 1024 * 1024 });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

const field = (stdout, label) => {
  const line = stdout.split("\n").find((l) => l.startsWith(`${label}: `));
  return line ? line.slice(label.length + 2) : null;
};

async function rows(url, text) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text)).rows;
  } finally {
    await client.end();
  }
}

before(async () => {
  db = await startPostgres({ migrate: false });
  workdir = await mkdtemp(path.join(os.tmpdir(), "kidcellence-migration-"));
});

after(async () => {
  const { closeDatabasePool } = await import(pathToFileURL(path.join(process.cwd(), "lib", "store-postgres.ts")).href);
  await closeDatabasePool();
  await db?.stop();
  await rm(workdir, { recursive: true, force: true });
});

describe("analysis", () => {
  it("blocks on orphan sessions and reports ignored records without exposing personal data", async () => {
    const source = await writeSource(legacyStore());
    const result = await migrate(["analyze", "--source", source]);
    assert.equal(result.code, 2);
    assert.match(result.stdout, /"kind":"orphan-user","collection":"sessions"/);
    assert.match(result.stdout, /dropped-by-normalize/);
    assert.doesNotMatch(result.stdout + result.stderr, /example\.invalid|Legacy Parent|tok-orphan|tok-a/);
  });

  it("blocks duplicate emails, which the unique constraint would reject", async () => {
    const store = legacyStore();
    store.users.push({ ...store.users[1], id: "user-dupe", email: " PARENT@example.invalid " });
    const result = await migrate(["analyze", "--source", await writeSource(store)]);
    assert.equal(result.code, 2);
    assert.match(result.stdout, /duplicate-email/);
  });

  it("refuses a source that is not valid JSON", async () => {
    const file = path.join(workdir, "broken.json");
    await writeFile(file, '{"users": [');
    const result = await migrate(["analyze", "--source", file]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /not valid JSON/);
  });
});

describe("dry run", () => {
  it("imports into a throwaway database, re-runs as a no-op, and cleans up", async () => {
    const source = await writeSource(legacyStore());
    const result = await migrate(["dry-run", "--source", source, "--drop-orphan-sessions"]);
    assert.equal(result.code, 0, result.stderr);
    const dryRun = JSON.parse(field(result.stdout, "dry run"));
    assert.equal(dryRun.first, "imported");
    assert.equal(dryRun.second, "already-imported");
    assert.deepEqual(dryRun.counts, { users: 3, sessions: 1, conversations: 1, messages: 2, provider_profiles: 2, uploads: 2 });
  });
});

describe("import", () => {
  it("imports everything losslessly, in order, and the app can use it immediately", async () => {
    const url = await freshDatabase();
    const source = await writeSource(legacyStore());
    const analysis = await migrate(["analyze", "--source", source, "--drop-orphan-sessions"]);
    const sha = field(analysis.stdout, "source sha256");
    const imported = await migrate(["import", "--source", source, "--database-url", url, "--expect-sha256", sha, "--drop-orphan-sessions"]);
    assert.equal(imported.code, 0, imported.stderr);
    assert.equal(field(imported.stdout, "import"), "imported");
    const verified = await migrate(["verify", "--source", source, "--database-url", url, "--drop-orphan-sessions"]);
    assert.equal(verified.code, 0, verified.stderr);
    assert.match(verified.stdout, /database matches the source exactly/);

    // The application reads and writes the imported data directly.
    process.env.PLATFORM_DATABASE_URL = url;
    delete process.env.PLATFORM_DATABASE_ALLOW_EMPTY_INIT;
    const store = await import(pathToFileURL(path.join(process.cwd(), "lib", "platform-store.ts")).href);
    const visible = await store.readStore();
    assert.deepEqual(visible.users.map((u) => u.id), ["user-3", "user-2", "user-1"]);
    assert.deepEqual(visible.uploads.map((u) => u.id), ["upload-2", "upload-1"]);
    assert.deepEqual(visible.conversations.map((c) => c.id), ["conv-1"]);
    assert.deepEqual(visible.conversations[0].messages.map((m) => m.text), ["first", "second ü 😀"]);
    assert.equal(visible.platformAnalytics.pageViews, 321);
    assert.equal(visible.providerAnalytics["user-3"].messagesReceived, 5);
    assert.equal(visible.verifications.rejectedCount, 2);
    assert.ok(visible.providerProfiles["profile-only-9"], "profile-only listings survive");
    assert.ok(!visible.verifications.pendingProviders.some((p) => p.id === "seed-without-user"));
    const login = await store.createOrLoginUser({ mode: "login", role: "parent", email: "PARENT@example.invalid", password: PASSWORD });
    assert.equal(login.user.id, "user-2", "existing password hashes keep working");
    const session = await store.getSessionByToken("tok-a");
    assert.equal(session?.user.id, "user-2", "existing sessions keep working");
    await store.appendConversationMessage({ viewerUserId: "user-2", viewerRole: "parent", conversationId: "conv-1", text: "after import" });
    const after = await store.readStore();
    assert.equal(after.conversations[0].messages.at(-1).text, "after import");
    assert.equal(after.providerAnalytics["user-3"].messagesReceived, 6);
  });

  it("is idempotent for the same source and refuses a different one", async () => {
    const url = await freshDatabase();
    const source = await writeSource(legacyStore());
    const sha = field((await migrate(["analyze", "--source", source, "--drop-orphan-sessions"])).stdout, "source sha256");
    const args = ["import", "--source", source, "--database-url", url, "--expect-sha256", sha, "--drop-orphan-sessions"];
    assert.equal(field((await migrate(args)).stdout, "import"), "imported");
    const again = await migrate(args);
    assert.equal(again.code, 0);
    assert.equal(field(again.stdout, "import"), "already-imported");
    assert.equal((await rows(url, "SELECT count(*)::int AS n FROM users"))[0].n, 3, "no duplicates");

    const other = legacyStore();
    other.users[1].name = "Changed";
    const otherSource = await writeSource(other, "other.json");
    const otherSha = field((await migrate(["analyze", "--source", otherSource, "--drop-orphan-sessions"])).stdout, "source sha256");
    const refused = await migrate(["import", "--source", otherSource, "--database-url", url, "--expect-sha256", otherSha, "--drop-orphan-sessions"]);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /Refusing to import/);
  });

  it("refuses a database that already has records but no import marker", async () => {
    const url = await freshDatabase();
    await rows(url, `INSERT INTO uploads (id, data) VALUES ('stray', '{"id":"stray","userId":"u","type":"document"}')`);
    const source = await writeSource(legacyStore());
    const sha = field((await migrate(["analyze", "--source", source, "--drop-orphan-sessions"])).stdout, "source sha256");
    const refused = await migrate(["import", "--source", source, "--database-url", url, "--expect-sha256", sha, "--drop-orphan-sessions"]);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /already contains records/);
    assert.equal((await rows(url, "SELECT count(*)::int AS n FROM users"))[0].n, 0);
  });

  it("requires the operator to confirm which file is being imported", async () => {
    const url = await freshDatabase();
    const source = await writeSource(legacyStore());
    const result = await migrate(["import", "--source", source, "--database-url", url, "--expect-sha256", "0".repeat(64), "--drop-orphan-sessions"]);
    assert.equal(result.code, 64);
    assert.equal((await rows(url, "SELECT count(*)::int AS n FROM platform_meta"))[0].n, 0);
  });
});

describe("rollback export", () => {
  it("exports the database back into the legacy document format, including later writes", async () => {
    const url = await freshDatabase();
    const source = await writeSource(legacyStore());
    const sha = field((await migrate(["analyze", "--source", source, "--drop-orphan-sessions"])).stdout, "source sha256");
    await migrate(["import", "--source", source, "--database-url", url, "--expect-sha256", sha, "--drop-orphan-sessions"]);
    await rows(url, `INSERT INTO users (id, data) VALUES ('user-new', '{"id":"user-new","role":"parent","name":"After cutover","email":"new@example.invalid","passwordHash":"x","createdAt":"2026-11-10T00:00:00.000Z"}')`);
    const out = path.join(workdir, `export-${counter}.json`);
    const exported = await migrate(["export", "--database-url", url, "--out", out]);
    assert.equal(exported.code, 0, exported.stderr);
    const document = JSON.parse(await readFile(out, "utf8"));
    assert.deepEqual(document.users.map((u) => u.id), ["user-new", "user-3", "user-2", "user-1"]);
    assert.equal(document.platformAnalytics.pageViews, 321);
    assert.equal(document.verifications.rejectedCount, 2);
    assert.equal(document.conversations[0].messages.length, 2);
    // The export refuses to overwrite an existing file.
    const again = await migrate(["export", "--database-url", url, "--out", out]);
    assert.equal(again.code, 1);
  });
});
