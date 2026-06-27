import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  it("renders complete first-party account access flows", async () => {
    const authPage = await request("/auth");
    assert.equal(authPage.status, 200);
    const authMarkup = await authPage.text();
    assert.equal(authMarkup.includes("Continue with Google"), false);
    const authSource = await readFile(path.join(process.cwd(), "app", "auth", "page.tsx"), "utf8");
    assert.equal(authSource.match(/Confirm Password/g)?.length, 2);

    const resetPage = await request("/auth/reset-password?token=development-token");
    assert.equal(resetPage.status, 200);
    assert.match(await resetPage.text(), /Choose a new password/);

    const verificationPage = await request("/auth/verify-email?token=development-token");
    assert.equal(verificationPage.status, 200);
    assert.match(await verificationPage.text(), /Verify your email/);
  });

  it("renders public trust and support routes without placeholder links", async () => {
    const routes = [
      ["/safety", "Make every care decision carefully"],
      ["/privacy", "Your information should serve a clear purpose"],
      ["/terms", "Clear responsibilities build a trusted marketplace"],
      ["/help", "Find the right next step"],
    ];

    for (const [pathname, heading] of routes) {
      const response = await request(pathname);
      assert.equal(response.status, 200);
      assert.match(await response.text(), new RegExp(heading));
    }

    const home = await request("/");
    const homeMarkup = await home.text();
    assert.equal(homeMarkup.includes('href="#"'), false);
    assert.match(homeMarkup, /href="\/privacy"/);
    assert.match(homeMarkup, /href="\/terms"/);
  });

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

    const savedProfile = await request("/api/profiles/parent", {
      headers: { Cookie: cookie },
    });
    assert.equal(savedProfile.status, 200);
    assert.equal((await json(savedProfile)).profile.children[0].name, "Test Child");

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

    const conversations = await request("/api/messages", {
      headers: { Cookie: cookie },
    });
    assert.equal(conversations.status, 200);
    const conversationsPayload = await json(conversations);
    assert.equal(conversationsPayload.conversations[0].lastMessage, "Integration hello");

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

  it("supports email verification and password reset lifecycle", async () => {
    const email = `lifecycle-${Date.now()}@example.com`;
    const signup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "Lifecycle Parent",
        email,
        password: "password123",
        location: "gaborone",
      }),
    });
    assert.equal(signup.status, 200);
    const cookie = cookieFrom(signup);
    assert.equal((await json(signup)).user.emailVerifiedAt, undefined);

    const verification = await request("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({}),
    });
    assert.equal(verification.status, 200);
    const verificationPayload = await json(verification);
    assert.ok(verificationPayload.delivery.token);

    const verified = await request("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ token: verificationPayload.delivery.token }),
    });
    assert.equal(verified.status, 200);
    assert.ok((await json(verified)).user.emailVerifiedAt);

    const reset = await request("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ email }),
    });
    assert.equal(reset.status, 200);
    const resetPayload = await json(reset);
    assert.ok(resetPayload.delivery.token);

    const applied = await request("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ token: resetPayload.delivery.token, password: "newpassword123" }),
    });
    assert.equal(applied.status, 200);
    assert.equal((await json(applied)).reset, true);

    const oldPassword = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ mode: "login", role: "parent", email, password: "password123" }),
    });
    assert.equal(oldPassword.status, 400);

    const newPassword = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ mode: "login", role: "parent", email, password: "newpassword123" }),
    });
    assert.equal(newPassword.status, 200);

    const oldSession = await request("/api/auth", { headers: { Cookie: cookie } });
    assert.equal(oldSession.status, 401);
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

    const incompletePublish = await request("/api/profiles/provider", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        profile: { category: "nurseries", published: true },
      }),
    });
    assert.equal(incompletePublish.status, 400);

    const profile = await request("/api/profiles/provider", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        profile: {
          displayName: "Integration Nursery",
          category: "nurseries",
          location: "Gaborone",
          bio: "A nurturing early learning programme for growing families.",
          phone: "+267 71 000 111",
          whatsapp: "+26771000111",
          services: ["Reception", "Aftercare"],
          experience: "Ten years serving families",
          availability: "Monday to Friday",
          published: true,
          verificationStatus: "approved",
          liveIn: true,
          feeRows: [{ grade: "Reception", termly: "4200", annually: "12600" }],
        },
      }),
    });
    assert.equal(profile.status, 200);
    const profilePayload = await json(profile);
    assert.ok(profilePayload.publicId);

    const savedProfile = await request("/api/profiles/provider", {
      headers: { Cookie: cookie },
    });
    assert.equal(savedProfile.status, 200);
    const savedProfilePayload = await json(savedProfile);
    assert.equal(savedProfilePayload.profile.category, "nurseries");
    assert.equal(savedProfilePayload.profile.feeRows[0].grade, "Reception");
    assert.equal(savedProfilePayload.profile.published, true);
    assert.equal(savedProfilePayload.profile.verificationStatus, "not_submitted");

    const discovery = await request("/api/providers?q=Integration%20Nursery");
    assert.equal(discovery.status, 200);
    const discoveryPayload = await json(discovery);
    assert.equal(discoveryPayload.providers.length, 1);
    assert.equal(discoveryPayload.providers[0].id, profilePayload.publicId);

    const publicProvider = await request(`/api/providers/${profilePayload.publicId}`);
    assert.equal(publicProvider.status, 200);
    const publicProviderPayload = await json(publicProvider);
    assert.equal(publicProviderPayload.provider.name, "Integration Nursery");
    assert.equal(publicProviderPayload.provider.price, 4200);
    assert.equal(publicProviderPayload.provider.verified, false);

    const publicPage = await request(`/provider/${profilePayload.publicId}`);
    assert.equal(publicPage.status, 200);
    assert.match(await publicPage.text(), /Integration Nursery/);

    const prematureSubmission = await request("/api/verifications", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(prematureSubmission.status, 400);

    const identityForm = new FormData();
    identityForm.set("type", "document");
    identityForm.set("documentKey", "national-id");
    identityForm.set("label", "National ID / Passport");
    identityForm.set(
      "file",
      new Blob(["test identity"], { type: "application/pdf" }),
      "identity.pdf"
    );
    const identityUpload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: identityForm,
    });
    assert.equal(identityUpload.status, 200);

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
    assert.equal((await json(list)).uploads.length, 2);

    const submitted = await request("/api/verifications", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(submitted.status, 200);
    assert.equal((await json(submitted)).status, "pending");

    const status = await request("/api/verifications", {
      headers: { Cookie: cookie },
    });
    assert.equal(status.status, 200);
    assert.equal((await json(status)).status, "pending");

    const adminLogin = await request("/api/auth", {
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
    assert.equal(adminLogin.status, 200);
    const adminCookie = cookieFrom(adminLogin);

    const queue = await request("/api/admin/verifications", {
      headers: { Cookie: adminCookie },
    });
    const queuePayload = await json(queue);
    const providerSubmission = queuePayload.pendingProviders.find(
      (item) => item.name === "Integration Nursery"
    );
    assert.ok(providerSubmission);

    const rejected = await request("/api/admin/verifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ id: providerSubmission.id, action: "reject" }),
    });
    assert.equal(rejected.status, 200);

    const rejectedStatus = await request("/api/verifications", {
      headers: { Cookie: cookie },
    });
    assert.equal((await json(rejectedStatus)).status, "rejected");

    const resubmitted = await request("/api/verifications", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(resubmitted.status, 200);

    const refreshedQueue = await request("/api/admin/verifications", {
      headers: { Cookie: adminCookie },
    });
    const refreshedQueuePayload = await json(refreshedQueue);
    const resubmission = refreshedQueuePayload.pendingProviders.find(
      (item) => item.name === "Integration Nursery"
    );
    assert.ok(resubmission);

    const approved = await request("/api/admin/verifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ id: resubmission.id, action: "approve" }),
    });
    assert.equal(approved.status, 200);

    const approvedProfile = await request("/api/profiles/provider", {
      headers: { Cookie: cookie },
    });
    const approvedProfilePayload = await json(approvedProfile);
    assert.equal(approvedProfilePayload.profile.verificationStatus, "approved");
    assert.equal(approvedProfilePayload.verified, true);

    const verifiedDiscovery = await request("/api/providers?q=Integration%20Nursery");
    const verifiedDiscoveryPayload = await json(verifiedDiscovery);
    assert.equal(verifiedDiscoveryPayload.providers[0].verified, true);

    const duplicateSubmission = await request("/api/verifications", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(duplicateSubmission.status, 400);

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

    const unpublish = await request("/api/profiles/provider", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        profile: { ...savedProfilePayload.profile, published: false },
      }),
    });
    assert.equal(unpublish.status, 200);
    assert.equal((await json(unpublish)).publicId, null);

    const hiddenProvider = await request(`/api/providers/${profilePayload.publicId}`);
    assert.equal(hiddenProvider.status, 404);
  });
});
