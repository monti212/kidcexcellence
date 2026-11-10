import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

/*
 * Versioned JSON documents with compare-and-swap writes.
 *
 * Every write names the version it was computed from and only lands if the
 * document is still at that version. A losing writer re-reads and re-runs its
 * updater, so concurrent updates are never silently dropped.
 *
 * This module has no "@/" imports so the regression tests can load it directly
 * with Node's TypeScript type stripping. Keep it free of syntax that needs
 * transformation (enums, namespaces, constructor parameter properties).
 */

export class StoreCorruptError extends Error {
  code = "STORE_CORRUPT";
  location: string;
  preservedCopy: string | null;

  // The message can reach API clients, so it names no paths. Details are logged.
  constructor(location: string, preservedCopy: string | null, cause?: unknown) {
    super(
      "Stored platform data could not be read, so this request was refused to " +
        "protect existing records. Nothing was reset.",
      { cause }
    );
    this.name = "StoreCorruptError";
    this.location = location;
    this.preservedCopy = preservedCopy;
    console.error(
      `[store-engine] ${location} is not valid JSON. It was left untouched. ` +
        "Recover manually: inspect it, then restore the last good copy (the .bak " +
        "file beside it, or a backup export)." +
        (preservedCopy ? ` A copy of the damaged file is at ${preservedCopy}.` : ""),
      cause
    );
  }
}

export const STORE_BUSY_MESSAGE =
  "The platform is busy saving other changes. Nothing was lost; please try again.";

export class StoreBusyError extends Error {
  code = "STORE_BUSY";

  constructor(message: string) {
    super(message);
    this.name = "StoreBusyError";
  }
}

export interface DocumentSnapshot {
  value: unknown;
  /** Opaque version: a hash of the file content. Never empty. */
  version: string;
}

export interface DocumentBackend {
  description: string;
  /** Returns null only when the document does not exist. Throws StoreCorruptError for unreadable data. */
  read(): Promise<DocumentSnapshot | null>;
  /**
   * Writes only if the stored version still equals `expectedVersion`, or, when
   * `expectedVersion` is null, only if the document does not exist yet.
   * Returns false when that condition failed.
   */
  write(value: unknown, expectedVersion: string | null): Promise<boolean>;
  /** Optional mutual exclusion around a whole read-modify-write (file backend). */
  exclusive?<R>(work: () => Promise<R>): Promise<R>;
}

export interface DocumentOptions<T> {
  backend: DocumentBackend;
  normalize(raw: unknown): T;
  /** Value used when the document does not exist yet. Only written by an update. */
  createInitial(): T | Promise<T>;
  maxAttempts?: number;
  retryDelayMs?: number;
  onConflict?(attempt: number): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assertJsonObject(value: unknown, location: string, preservedCopy: string | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StoreCorruptError(location, preservedCopy, new Error("Top-level value is not an object"));
  }
}

/** Reads without ever writing. A missing document yields `createInitial()` in memory. */
export async function readDocument<T>(options: DocumentOptions<T>): Promise<T> {
  const snapshot = await options.backend.read();
  return snapshot ? options.normalize(snapshot.value) : options.createInitial();
}

/**
 * Runs `updater` against the latest version and commits it with a conditional
 * write, retrying on conflict. The updater can run more than once, so it must
 * only change the document it is given; do side effects after this resolves.
 * Throwing from the updater aborts without writing. An updater that changes
 * nothing causes no write.
 */
export async function updateDocument<T, R>(
  options: DocumentOptions<T>,
  updater: (document: T) => R | Promise<R>
): Promise<R> {
  const maxAttempts = options.maxAttempts ?? 10;
  const retryDelayMs = options.retryDelayMs ?? 15;

  const attempt = async () => {
    const snapshot = await options.backend.read();
    const document = snapshot
      ? options.normalize(snapshot.value)
      : await options.createInitial();
    const before = JSON.stringify(document);
    const result = await updater(document);
    if (JSON.stringify(document) === before) return { committed: true, result };
    const committed = await options.backend.write(document, snapshot?.version ?? null);
    return { committed, result };
  };

  for (let count = 1; ; count += 1) {
    const outcome = options.backend.exclusive
      ? await options.backend.exclusive(attempt)
      : await attempt();
    if (outcome.committed) return outcome.result;
    if (count >= maxAttempts) {
      console.error(
        `[store-engine] gave up saving ${options.backend.description} after ${maxAttempts} conflicting attempts`
      );
      throw new StoreBusyError(STORE_BUSY_MESSAGE);
    }
    options.onConflict?.(count);
    const backoff = Math.min(retryDelayMs * 2 ** (count - 1), 400);
    await sleep(backoff * (0.5 + Math.random()));
  }
}

function hashContents(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

function errorCode(error: unknown) {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

async function preserveCorruptFile(filePath: string, contents: string) {
  const copyPath = `${filePath}.corrupt-${hashContents(contents).slice(0, 12)}`;
  try {
    await copyFile(filePath, copyPath, fsConstants.COPYFILE_EXCL);
  } catch (error) {
    // The same damaged content was already preserved; keep the first copy.
    if (errorCode(error) !== "EEXIST") return null;
  }
  return copyPath;
}

async function writeFileAtomically(filePath: string, contents: string) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`
  );
  const handle = await open(tempPath, "wx");
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
  // Persist the rename itself. Not every platform allows syncing a directory.
  const directory = await open(path.dirname(filePath), "r").catch(() => null);
  if (directory) {
    await directory.sync().catch(() => undefined);
    await directory.close();
  }
}

/**
 * Cross-process lock using an exclusively created lock file. A lock older than
 * `staleMs` is treated as abandoned by a crashed process and removed.
 */
async function withFileLock<R>(
  lockPath: string,
  work: () => Promise<R>,
  timeoutMs: number,
  staleMs: number
): Promise<R> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`);
      await handle.close();
      break;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
    }
    const lockStat = await stat(lockPath).catch(() => null);
    if (lockStat && Date.now() - lockStat.mtimeMs > staleMs) {
      await rm(lockPath, { force: true });
      continue;
    }
    if (Date.now() > deadline) {
      console.error(
        `[store-engine] timed out waiting for ${lockPath}. If no process is using ` +
          "the store, the lock file can be deleted."
      );
      throw new StoreBusyError(STORE_BUSY_MESSAGE);
    }
    await sleep(5 + Math.random() * 20);
  }

  try {
    return await work();
  } finally {
    await rm(lockPath, { force: true });
  }
}

/**
 * JSON file backend. Writes go to a temporary file that is synced and renamed
 * into place, so readers only ever see a complete old or new file. Before
 * each write the previous version is kept as `<file>.bak`. Invalid JSON is
 * never treated as missing: reads throw StoreCorruptError and the file is left
 * untouched, with a copy saved alongside it.
 */
export function createFileBackend(
  filePath: string,
  options: { lockTimeoutMs?: number; staleLockMs?: number } = {}
): DocumentBackend {
  const lockPath = `${filePath}.lock`;
  const lockTimeoutMs = options.lockTimeoutMs ?? 15000;
  const staleLockMs = options.staleLockMs ?? 30000;

  const readContents = async () => {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      if (errorCode(error) === "ENOENT") return null;
      throw error;
    }
  };

  return {
    description: filePath,
    async read() {
      const contents = await readContents();
      if (contents === null) return null;
      let value: unknown;
      try {
        value = JSON.parse(contents);
      } catch (cause) {
        throw new StoreCorruptError(filePath, await preserveCorruptFile(filePath, contents), cause);
      }
      assertJsonObject(value, filePath, null);
      return { value, version: hashContents(contents) };
    },
    async write(value, expectedVersion) {
      const current = await readContents();
      const currentVersion = current === null ? null : hashContents(current);
      if (currentVersion !== expectedVersion) return false;
      await mkdir(path.dirname(filePath), { recursive: true });
      if (current !== null) {
        await writeFileAtomically(`${filePath}.bak`, current);
      }
      await writeFileAtomically(filePath, `${JSON.stringify(value, null, 2)}\n`);
      return true;
    },
    async exclusive(work) {
      await mkdir(path.dirname(filePath), { recursive: true });
      return withFileLock(lockPath, work, lockTimeoutMs, staleLockMs);
    },
  };
}

export const PRODUCTION_BLOB_STORE_NAME = "kidcellence-platform";
export const PRODUCTION_UPLOAD_BLOB_STORE_NAME = "kidcellence-uploads";

/**
 * Which Netlify Blobs stores to use. There is deliberately no default: Netlify
 * shares site-wide stores across production, deploy previews and branch
 * deploys, so guessing could point a preview at production data.
 *
 * - PLATFORM_BLOB_STORE_NAME must be set (per deploy context, Functions scope).
 * - The production store name additionally needs
 *   PLATFORM_BLOB_STORE_ALLOW_PRODUCTION=true, set only in the Production
 *   context, so one mis-scoped variable cannot reach production data.
 * - If CONTEXT is visible at runtime and is not "production", the production
 *   store is refused even when both variables are set.
 */
export function resolveBlobStoreNames(env: Record<string, string | undefined>) {
  const platform = env.PLATFORM_BLOB_STORE_NAME?.trim();
  if (!platform) {
    throw new Error(
      "PLATFORM_BLOB_STORE_NAME is not set. Refusing to pick a Netlify Blobs store " +
        "automatically, because deploy previews would otherwise share production data. " +
        "Set it per deploy context in the Netlify dashboard with the Functions scope."
    );
  }

  if (platform === PRODUCTION_BLOB_STORE_NAME) {
    if (env.PLATFORM_BLOB_STORE_ALLOW_PRODUCTION?.trim() !== "true") {
      throw new Error(
        `PLATFORM_BLOB_STORE_NAME is the production store (${PRODUCTION_BLOB_STORE_NAME}) ` +
          "but PLATFORM_BLOB_STORE_ALLOW_PRODUCTION is not \"true\". Set that flag only " +
          "in the Production deploy context."
      );
    }
    const context = env.CONTEXT?.trim();
    if (context && context !== "production") {
      throw new Error(
        `Refusing the production store in the "${context}" deploy context. ` +
          "Give this context its own PLATFORM_BLOB_STORE_NAME."
      );
    }
    return { platform, uploads: PRODUCTION_UPLOAD_BLOB_STORE_NAME };
  }

  if (platform === PRODUCTION_UPLOAD_BLOB_STORE_NAME) {
    throw new Error("PLATFORM_BLOB_STORE_NAME must not be the production uploads store.");
  }

  return { platform, uploads: `${platform}-uploads` };
}
