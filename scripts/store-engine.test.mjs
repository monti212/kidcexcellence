// Regression tests for lib/store-engine.ts: compare-and-swap updates, atomic
// file writes (the local-development store), corruption handling, recovery, and
// the upload-store naming rules. The Netlify Blobs document backend was removed
// after it lost acknowledged writes on live Netlify; see docs/persistence-architecture.md.
//
// Node loads the TypeScript engine directly through type stripping.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const engineUrl = pathToFileURL(path.join(process.cwd(), "lib", "store-engine.ts")).href;
const {
  StoreBusyError,
  StoreCorruptError,
  createFileBackend,
  readDocument,
  resolveBlobStoreNames,
  updateDocument,
} = await import(engineUrl);

const tick = () => new Promise((resolve) => setImmediate(resolve));

// An in-memory backend whose compare-and-swap is atomic (check and set happen
// in one synchronous step), standing in for a correct remote store.
function memoryBackend(initial = null) {
  let value = initial === null ? null : structuredClone(initial);
  let version = 0;
  const backend = {
    description: "memory",
    writes: 0,
    get value() {
      return value;
    },
    async read() {
      await tick();
      return value === null ? null : { value: structuredClone(value), version: `v${version}` };
    },
    async write(next, expectedVersion) {
      await tick();
      const currentVersion = value === null ? null : `v${version}`;
      if (currentVersion !== expectedVersion) return false;
      value = structuredClone(next);
      version += 1;
      backend.writes += 1;
      return true;
    },
  };
  return backend;
}

const counterDocument = (backend, extra = {}) => ({
  backend,
  normalize: (raw) => ({ count: raw.count ?? 0, log: raw.log ?? [] }),
  createInitial: () => ({ count: 0, log: [] }),
  retryDelayMs: 1,
  maxAttempts: 200,
  ...extra,
});

const increment = (doc) => updateDocument(doc, (value) => {
  value.count += 1;
  return value.count;
});

let tmpRoot;
before(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "kidcellence-store-engine-"));
});
after(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("compare-and-swap updates", () => {
  it("keeps every concurrent update (40 writers, one document)", async () => {
    const backend = memoryBackend({ count: 0 });
    await Promise.all(Array.from({ length: 40 }, () => increment(counterDocument(backend))));
    assert.equal(backend.value.count, 40);
  });

  it("control: an unconditional read-modify-write loses updates under the same load", async () => {
    // Proves the harness can see the bug the engine prevents.
    const backend = memoryBackend({ count: 0 });
    await Promise.all(
      Array.from({ length: 40 }, async () => {
        const snapshot = await backend.read();
        snapshot.value.count += 1;
        await backend.write(snapshot.value, backend.value === null ? null : (await backend.read()).version);
      })
    );
    assert.ok(backend.value.count < 40, `expected lost updates, got ${backend.value.count}`);
  });

  it("does not write when the updater throws, and surfaces the error", async () => {
    const backend = memoryBackend({ count: 5 });
    await assert.rejects(
      updateDocument(counterDocument(backend), (value) => {
        value.count = 999;
        throw new Error("validation failed");
      }),
      /validation failed/
    );
    assert.equal(backend.value.count, 5);
    assert.equal(backend.writes, 0);
  });

  it("does not write when the updater changes nothing", async () => {
    const backend = memoryBackend({ count: 5 });
    const result = await updateDocument(counterDocument(backend), (value) => value.count);
    assert.equal(result, 5);
    assert.equal(backend.writes, 0);
  });

  it("gives up with StoreBusyError after the retry limit, without writing", async () => {
    const backend = memoryBackend({ count: 1 });
    backend.write = async () => false;
    await assert.rejects(
      updateDocument(counterDocument(backend, { maxAttempts: 3 }), (value) => {
        value.count += 1;
      }),
      (error) => error instanceof StoreBusyError && error.code === "STORE_BUSY"
    );
    assert.equal(backend.value.count, 1);
  });

  it("creates a missing document once, even with concurrent first writers (migration seed)", async () => {
    const backend = memoryBackend(null);
    let seeds = 0;
    const doc = counterDocument(backend, {
      createInitial: async () => {
        seeds += 1;
        await tick();
        return { count: 100, log: [] }; // e.g. analytics carried over from the main store
      },
    });
    await Promise.all(Array.from({ length: 20 }, () => increment(doc)));
    assert.equal(backend.value.count, 120, "seed applied once, every event counted once");
    assert.ok(seeds >= 1);
  });

  it("reads a missing document without creating it", async () => {
    const backend = memoryBackend(null);
    const value = await readDocument(counterDocument(backend));
    assert.deepEqual(value, { count: 0, log: [] });
    assert.equal(backend.value, null);
    assert.equal(backend.writes, 0);
  });
});

describe("file backend", () => {
  const fileDocument = (filePath, extra = {}) => ({
    ...counterDocument(createFileBackend(filePath, extra.backendOptions)),
    ...extra,
  });

  it("keeps every concurrent update in one process and writes valid JSON", async () => {
    const filePath = path.join(tmpRoot, "concurrent", "store.json");
    await Promise.all(Array.from({ length: 30 }, () => increment(fileDocument(filePath))));
    const saved = JSON.parse(await readFile(filePath, "utf8"));
    assert.equal(saved.count, 30);
    const backup = JSON.parse(await readFile(`${filePath}.bak`, "utf8"));
    assert.equal(backup.count, 29, "the .bak file holds the previous version");
    const leftovers = (await readdir(path.dirname(filePath))).filter(
      (name) => name.endsWith(".tmp") || name.endsWith(".lock")
    );
    assert.deepEqual(leftovers, []);
  });

  it("keeps every update across separate processes sharing one file", async () => {
    const filePath = path.join(tmpRoot, "multiprocess", "store.json");
    const child = `
      const { createFileBackend, updateDocument } = await import(${JSON.stringify(engineUrl)});
      const doc = {
        backend: createFileBackend(${JSON.stringify(filePath)}),
        normalize: (raw) => ({ count: raw.count ?? 0 }),
        createInitial: () => ({ count: 0 }),
      };
      for (let i = 0; i < 15; i += 1) {
        await Promise.all([1, 2].map(() => updateDocument(doc, (value) => { value.count += 1; })));
      }
    `;
    const runChild = () =>
      new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, ["--no-warnings", "--input-type=module", "-e", child], {
          stdio: ["ignore", "ignore", "pipe"],
        });
        let stderr = "";
        proc.stderr.on("data", (chunk) => (stderr += chunk));
        proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
      });
    await Promise.all([runChild(), runChild(), runChild(), runChild()]);
    const saved = JSON.parse(await readFile(filePath, "utf8"));
    assert.equal(saved.count, 4 * 15 * 2);
  });

  it("fails closed on invalid JSON: no reset, original untouched, copy preserved", async () => {
    const filePath = path.join(tmpRoot, "corrupt", "store.json");
    await increment(fileDocument(filePath));
    const damaged = '{"count": 1, "users": [ truncated';
    await writeFile(filePath, damaged);

    await assert.rejects(readDocument(fileDocument(filePath)), (error) => {
      assert.ok(error instanceof StoreCorruptError);
      assert.equal(error.code, "STORE_CORRUPT");
      assert.ok(error.preservedCopy, "a copy of the damaged file is kept");
      return true;
    });
    await assert.rejects(increment(fileDocument(filePath)), StoreCorruptError);

    assert.equal(await readFile(filePath, "utf8"), damaged, "the damaged file is not overwritten");
    const copies = (await readdir(path.dirname(filePath))).filter((name) => name.includes(".corrupt-"));
    assert.equal(copies.length, 1);
    assert.equal(await readFile(path.join(path.dirname(filePath), copies[0]), "utf8"), damaged);
  });

  it("treats non-object JSON as corrupt rather than empty", async () => {
    const filePath = path.join(tmpRoot, "not-object", "store.json");
    await increment(fileDocument(filePath));
    await writeFile(filePath, "null");
    await assert.rejects(readDocument(fileDocument(filePath)), StoreCorruptError);
    assert.equal(await readFile(filePath, "utf8"), "null");
  });

  it("recovers after a manual restore from the .bak copy, with no data lost", async () => {
    const filePath = path.join(tmpRoot, "recover", "store.json");
    for (let i = 0; i < 3; i += 1) await increment(fileDocument(filePath));
    const good = await readFile(filePath, "utf8");
    await writeFile(filePath, "{ not json");
    await assert.rejects(readDocument(fileDocument(filePath)), StoreCorruptError);

    // Controlled manual recovery: put the last good copy back.
    await writeFile(filePath, good);
    assert.equal((await readDocument(fileDocument(filePath))).count, 3);
    assert.equal(await increment(fileDocument(filePath)), 4);
  });

  it("never writes during reads", async () => {
    const filePath = path.join(tmpRoot, "readonly", "store.json");
    await increment(fileDocument(filePath));
    const before = await stat(filePath);
    const contents = await readFile(filePath, "utf8");
    await new Promise((resolve) => setTimeout(resolve, 20));
    for (let i = 0; i < 10; i += 1) await readDocument(fileDocument(filePath));
    const afterStat = await stat(filePath);
    assert.equal(afterStat.mtimeMs, before.mtimeMs);
    assert.equal(await readFile(filePath, "utf8"), contents);
    const entries = await readdir(path.dirname(filePath));
    assert.ok(!entries.some((name) => name.endsWith(".lock")));
  });

  it("removes a stale lock left by a crashed process, but waits on a live one", async () => {
    const filePath = path.join(tmpRoot, "locks", "store.json");
    await increment(fileDocument(filePath));
    const lockPath = `${filePath}.lock`;

    await writeFile(lockPath, "12345 crashed\n");
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);
    assert.equal(await increment(fileDocument(filePath)), 2);

    await writeFile(lockPath, "12345 busy\n");
    await assert.rejects(
      increment(fileDocument(filePath, { backendOptions: { lockTimeoutMs: 200 } })),
      StoreBusyError
    );
    await rm(lockPath, { force: true });
    assert.equal((await readDocument(fileDocument(filePath))).count, 2);
  });
});

describe("blob store selection (deploy preview isolation)", () => {
  it("refuses to run when PLATFORM_BLOB_STORE_NAME is missing", () => {
    assert.throws(() => resolveBlobStoreNames({}), /PLATFORM_BLOB_STORE_NAME is not set/);
    assert.throws(() => resolveBlobStoreNames({ PLATFORM_BLOB_STORE_NAME: "  " }), /not set/);
  });

  it("requires the production flag for the production store", () => {
    assert.throws(
      () => resolveBlobStoreNames({ PLATFORM_BLOB_STORE_NAME: "kidcellence-platform" }),
      /PLATFORM_BLOB_STORE_ALLOW_PRODUCTION/
    );
  });

  it("refuses the production store in a non-production context even with the flag", () => {
    for (const context of ["deploy-preview", "branch-deploy", "dev"]) {
      assert.throws(
        () =>
          resolveBlobStoreNames({
            PLATFORM_BLOB_STORE_NAME: "kidcellence-platform",
            PLATFORM_BLOB_STORE_ALLOW_PRODUCTION: "true",
            CONTEXT: context,
          }),
        /Refusing the production store/
      );
    }
  });

  it("keeps the existing production store names when explicitly allowed", () => {
    assert.deepEqual(
      resolveBlobStoreNames({
        PLATFORM_BLOB_STORE_NAME: "kidcellence-platform",
        PLATFORM_BLOB_STORE_ALLOW_PRODUCTION: "true",
      }),
      { platform: "kidcellence-platform", uploads: "kidcellence-uploads" }
    );
  });

  it("gives a preview store its own uploads store", () => {
    assert.deepEqual(resolveBlobStoreNames({ PLATFORM_BLOB_STORE_NAME: "kidcellence-platform-preview" }), {
      platform: "kidcellence-platform-preview",
      uploads: "kidcellence-platform-preview-uploads",
    });
    assert.throws(
      () => resolveBlobStoreNames({ PLATFORM_BLOB_STORE_NAME: "kidcellence-uploads" }),
      /uploads store/
    );
  });
});
