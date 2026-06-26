import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

const port = Number(process.env.TEST_PORT ?? 3210);
const baseUrl = `http://localhost:${port}`;
const tmpRoot = await mkdtemp(path.join(tmpdir(), "kidcexcellence-test-"));
const env = {
  ...process.env,
  ADMIN_EMAILS: "admin-test@example.com",
  PLATFORM_STORE_PATH: path.join(tmpRoot, "platform-store.json"),
  PLATFORM_UPLOADS_DIR: path.join(tmpRoot, "uploads"),
};

let server;

function cookieFrom(response) {
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "expected set-cookie header");
  return cookie.split(";")[0];
}

async function json(response) {
  const payload = await response.json();
  return payload;
}

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

async function waitForServer() {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < 30000) {
    try {
      const response = await request("/");
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError ?? new Error("Timed out waiting for test server");
}

before(async () => {
  server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  server.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
  server.on("exit", (code) => {
    if (code && code !== 0) {
      process.stderr.write(logs);
    }
  });

  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
  }
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("Kidcexcellence platform APIs", () => {
  it("creates a parent session, protects profile writes, sends messages, and logs out", async () => {
    const email = `parent-${Date.now()}@example.com`;
    const signup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "Integration Parent",
        email,
        password: "password123",
        location: "gaborone",
      }),
    });

    assert.equal(signup.status, 200);
    const cookie = cookieFrom(signup);
    const auth = await json(signup);
    assert.equal(auth.user.role, "parent");
    assert.equal(auth.session.userId, auth.user.id);

    const unauthProfile = await request("/api/profiles/parent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ children: [] }),
    });
    assert.equal(unauthProfile.status, 401);

    const profile = await request("/api/profiles/parent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        children: [{ id: "child-1", name: "Test Child", dob: "2022-06-15", specialNeeds: "" }],
      }),
    });
    assert.equal(profile.status, 200);
    assert.equal((await json(profile)).profile.children[0].name, "Test Child");

    const message = await request("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ conversationId: "conv1", text: "Integration hello" }),
    });
    assert.equal(message.status, 200);
    assert.equal((await json(message)).message.text, "Integration hello");

    const logout = await request("/api/auth", {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(logout.status, 200);
    const afterLogout = await request("/api/auth", { headers: { Cookie: cookie } });
    assert.equal(afterLogout.status, 401);
  });

  it("enforces admin allowlist and supports verification decisions", async () => {
    const denied = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "login",
        role: "admin",
        email: "not-admin@example.com",
        password: "password123",
      }),
    });
    assert.equal(denied.status, 403);

    const login = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "login",
        role: "admin",
        email: "admin-test@example.com",
        password: "password123",
      }),
    });
    assert.equal(login.status, 200);
    const cookie = cookieFrom(login);

    const queue = await request("/api/admin/verifications", {
      headers: { Cookie: cookie },
    });
    assert.equal(queue.status, 200);
    const queuePayload = await json(queue);
    assert.ok(queuePayload.pendingProviders.length > 0);

    const decision = await request("/api/admin/verifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        id: queuePayload.pendingProviders[0].id,
        action: "approve",
      }),
    });
    assert.equal(decision.status, 200);
    assert.equal((await json(decision)).pendingProviders.length, queuePayload.pendingProviders.length - 1);
  });

  it("supports provider document and gallery uploads with owner-only access", async () => {
    const email = `provider-${Date.now()}@example.com`;
    const signup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "provider",
        name: "Integration Provider",
        email,
        password: "password123",
        category: "schools",
        location: "gaborone",
      }),
    });
    assert.equal(signup.status, 200);
    const cookie = cookieFrom(signup);

    const form = new FormData();
    form.set("type", "document");
    form.set("documentKey", "cv");
    form.set("label", "CV / Resume");
    form.set("file", new Blob(["test document"], { type: "application/pdf" }), "cv.pdf");

    const upload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: form,
    });
    assert.equal(upload.status, 200);
    const uploadPayload = await json(upload);
    assert.equal(uploadPayload.upload.fileName, "cv.pdf");

    const list = await request("/api/uploads", {
      headers: { Cookie: cookie },
    });
    assert.equal(list.status, 200);
    assert.equal((await json(list)).uploads.length, 1);

    const file = await request(uploadPayload.upload.url, {
      headers: { Cookie: cookie },
    });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "application/pdf");
    assert.equal(await file.text(), "test document");

    const noCookie = await request(uploadPayload.upload.url);
    assert.equal(noCookie.status, 401);

    const deleted = await request(uploadPayload.upload.url, {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(deleted.status, 200);

    const afterDelete = await request(uploadPayload.upload.url, {
      headers: { Cookie: cookie },
    });
    assert.equal(afterDelete.status, 404);
  });
});
