import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

const port = Number(process.env.TEST_PORT ?? 3210);
const baseUrl = `http://localhost:${port}`;
const tmpRoot = await mkdtemp(path.join(tmpdir(), "kidcellence-test-"));
const env = {
  ...process.env,
  ADMIN_EMAILS: "admin-test@example.com",
  ENABLE_DEMO_PROVIDERS: "true",
  PLATFORM_STORAGE_DRIVER: "filesystem",
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

describe("Kidcellence platform APIs", () => {
  it("renders complete first-party account access flows", async () => {
    const authPage = await request("/auth");
    assert.equal(authPage.status, 200);
    const authMarkup = await authPage.text();
    assert.equal(authMarkup.includes("Continue with Google"), false);
    const authSource = await readFile(path.join(process.cwd(), "app", "auth", "page.tsx"), "utf8");
    assert.equal(authSource.match(/Confirm Password/g)?.length, 3);
    assert.match(authSource, /I&?apos;m an Admin|Create Admin Account/);

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
    assert.equal(homeMarkup.includes("500+"), false);
    assert.equal(homeMarkup.includes("reply tracking"), false);
    assert.equal(homeMarkup.includes("Live provider desk"), false);
    assert.match(homeMarkup, />12<\/div><div[^>]*>\s*service categories/);
    assert.equal(/>13<\/div><div[^>]*>\s*service categories/.test(homeMarkup), false);
    assert.match(homeMarkup, /href="\/privacy"/);
    assert.match(homeMarkup, /href="\/terms"/);

    const search = await request("/search");
    assert.equal(search.status, 200);
    assert.equal((await search.text()).includes("Map View"), false);

    const providerIndex = await request("/api/providers");
    const providerIndexPayload = await json(providerIndex);
    assert.equal(providerIndexPayload.categories.length, 12);
    assert.equal(providerIndexPayload.additionalCategories.length, 1);
    const listedCategoryCount = [
      ...providerIndexPayload.categories,
      ...providerIndexPayload.additionalCategories,
    ].reduce((total, category) => total + category.count, 0);
    const nurseryProviderCount = providerIndexPayload.providers.filter(
      (provider) => provider.category === "nurseries"
    ).length;
    assert.equal(listedCategoryCount + nurseryProviderCount, providerIndexPayload.providers.length);
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
        profile: {
          fullName: "Updated Integration Parent",
          dateOfBirth: "1990-03-22",
          nationality: "Motswana",
          location: "maun",
          phone: "+267 71 234 567",
          bio: "Looking for trusted childcare.",
          email: "attacker@example.com",
          children: [
            { id: "child-1", name: "Test Child", dob: "2022-06-15", specialNeeds: "" },
          ],
        },
      }),
    });
    assert.equal(profile.status, 200);
    const profilePayload = await json(profile);
    assert.equal(profilePayload.profile.children[0].name, "Test Child");
    assert.equal(profilePayload.user.name, "Updated Integration Parent");
    assert.equal(profilePayload.user.email, email);

    const savedProfile = await request("/api/profiles/parent", {
      headers: { Cookie: cookie },
    });
    assert.equal(savedProfile.status, 200);
    const savedProfilePayload = await json(savedProfile);
    assert.equal(savedProfilePayload.profile.children[0].name, "Test Child");
    assert.equal(savedProfilePayload.profile.location, "maun");
    assert.equal(savedProfilePayload.profile.bio, "Looking for trusted childcare.");

    const updatedSession = await request("/api/auth", {
      headers: { Cookie: cookie },
    });
    const updatedSessionPayload = await json(updatedSession);
    assert.equal(updatedSessionPayload.user.name, "Updated Integration Parent");
    assert.equal(updatedSessionPayload.user.phone, "+267 71 234 567");
    assert.equal(updatedSessionPayload.user.email, email);

    const unauthMessages = await request("/api/messages");
    assert.equal(unauthMessages.status, 401);

    const startedConversation = await request("/api/messages?provider=1", {
      headers: { Cookie: cookie },
    });
    assert.equal(startedConversation.status, 200);
    const startedConversationPayload = await json(startedConversation);
    assert.equal(startedConversationPayload.conversations.length, 1);
    assert.equal(startedConversationPayload.conversations[0].messages.length, 0);
    const conversationId = startedConversationPayload.conversations[0].id;

    const message = await request("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ conversationId, providerId: "1", text: "Integration hello" }),
    });
    assert.equal(message.status, 200);
    assert.equal((await json(message)).message.text, "Integration hello");

    const conversations = await request("/api/messages", {
      headers: { Cookie: cookie },
    });
    assert.equal(conversations.status, 200);
    const conversationsPayload = await json(conversations);
    assert.equal(conversationsPayload.conversations[0].lastMessage, "Integration hello");
    assert.equal(conversationsPayload.conversations[0].messages[0].isOwn, true);

    const secondParentSignup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "Other Parent",
        email: `other-parent-${Date.now()}@example.com`,
        password: "password123",
        location: "maun",
      }),
    });
    assert.equal(secondParentSignup.status, 200);
    const secondParentCookie = cookieFrom(secondParentSignup);
    const isolatedInbox = await request("/api/messages", {
      headers: { Cookie: secondParentCookie },
    });
    assert.equal((await json(isolatedInbox)).conversations.length, 0);

    const forbiddenAppend = await request("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: secondParentCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ conversationId, text: "Cross-account write" }),
    });
    assert.equal(forbiddenAppend.status, 404);

    const logout = await request("/api/auth", {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(logout.status, 200);
    const afterLogout = await request("/api/auth", { headers: { Cookie: cookie } });
    assert.equal(afterLogout.status, 401);
  });

  it("enforces admin allowlist and supports verification decisions", async () => {
    const firstTrafficEvent = await request("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ visitorId: "visitor-a", pathname: "/" }),
    });
    assert.equal(firstTrafficEvent.status, 200);
    const secondTrafficEvent = await request("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ visitorId: "visitor-a", pathname: "/search" }),
    });
    assert.equal(secondTrafficEvent.status, 200);
    const thirdTrafficEvent = await request("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ visitorId: "visitor-b", pathname: "/pricing" }),
    });
    assert.equal(thirdTrafficEvent.status, 200);

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

    const builtInAdminSignup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "admin",
        name: "Built In Admin",
        email: "monti@uhuruai.co",
        password: "password123",
      }),
    });
    assert.equal(builtInAdminSignup.status, 200);
    const builtInAdminPayload = await json(builtInAdminSignup);
    assert.equal(builtInAdminPayload.user.role, "admin");
    const builtInAdminCookie = cookieFrom(builtInAdminSignup);
    const builtInAdminQueue = await request("/api/admin/verifications", {
      headers: { Cookie: builtInAdminCookie },
    });
    assert.equal(builtInAdminQueue.status, 200);

    const regularAuthAdminSignup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "Regular Auth Admin",
        email: "gaone@uhuruai.co",
        password: "password123",
      }),
    });
    assert.equal(regularAuthAdminSignup.status, 200);
    const regularAuthAdminPayload = await json(regularAuthAdminSignup);
    assert.equal(regularAuthAdminPayload.user.role, "admin");
    const regularAuthAdminCookie = cookieFrom(regularAuthAdminSignup);
    const regularAuthAdminQueue = await request("/api/admin/verifications", {
      headers: { Cookie: regularAuthAdminCookie },
    });
    assert.equal(regularAuthAdminQueue.status, 200);

    const regularAuthAdminLogin = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "login",
        role: "parent",
        email: "gaone@uhuruai.co",
        password: "password123",
      }),
    });
    assert.equal(regularAuthAdminLogin.status, 200);
    assert.equal((await json(regularAuthAdminLogin)).user.role, "admin");

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
    assert.equal(queuePayload.pendingProviders.length, 0);
    assert.equal(queuePayload.stats.totalProviders, 0);
    assert.ok(queuePayload.stats.totalParents > 0);
    assert.equal(queuePayload.approvedProviders.length, 0);
    assert.equal(queuePayload.platformAnalytics.totalVisitors, 2);
    assert.equal(queuePayload.platformAnalytics.totalPageViews, 3);
    assert.equal(queuePayload.platformAnalytics.todayVisitors, 2);
    assert.equal(queuePayload.platformAnalytics.todayPageViews, 3);
    assert.ok(queuePayload.platformAnalytics.topPages.some((page) => page.path === "/search"));
    assert.equal(typeof queuePayload.stats.providerSignupsToday, "number");
    assert.equal(typeof queuePayload.stats.providerSignupsLast7Days, "number");
    assert.equal(typeof queuePayload.stats.parentSignupsToday, "number");
    assert.equal(typeof queuePayload.stats.parentSignupsLast7Days, "number");
    assert.equal(queuePayload.admin.email, "admin-test@example.com");

    const decision = await request("/api/admin/verifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        id: "",
        action: "approve",
      }),
    });
    assert.equal(decision.status, 400);
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
    const signupPayload = await json(signup);
    const cookie = cookieFrom(signup);
    assert.equal(signupPayload.user.emailVerifiedAt, undefined);

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

    const mixedEmailStore = JSON.parse(await readFile(env.PLATFORM_STORE_PATH, "utf8"));
    const mixedEmailUser = mixedEmailStore.users.find((user) => user.email === email);
    assert.ok(mixedEmailUser);
    mixedEmailUser.email = `  ${email.toUpperCase()}  `;
    await writeFile(
      env.PLATFORM_STORE_PATH,
      `${JSON.stringify(mixedEmailStore, null, 2)}\n`,
      "utf8"
    );

    const duplicateSignupWithPassword = await request("/api/auth", {
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
        password: "newpassword123",
        location: "gaborone",
      }),
    });
    assert.equal(duplicateSignupWithPassword.status, 200);
    assert.equal((await json(duplicateSignupWithPassword)).user.email, email);

    const spacedPassword = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "login",
        role: "parent",
        email,
        password: "  newpassword123  ",
      }),
    });
    assert.equal(spacedPassword.status, 200);

    const store = JSON.parse(await readFile(env.PLATFORM_STORE_PATH, "utf8"));
    const lifecycleUser = store.users.find((user) => user.email === email);
    assert.ok(lifecycleUser);
    lifecycleUser.passwordHash = "legacysecret123";
    await writeFile(env.PLATFORM_STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

    const legacyPassword = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "login",
        role: "parent",
        email,
        password: "legacysecret123",
      }),
    });
    assert.equal(legacyPassword.status, 200);
    const migratedStore = JSON.parse(await readFile(env.PLATFORM_STORE_PATH, "utf8"));
    assert.match(
      migratedStore.users.find((user) => user.email === email).passwordHash,
      /^[^:]+:[0-9a-f]+$/
    );

    const placeholderStore = JSON.parse(await readFile(env.PLATFORM_STORE_PATH, "utf8"));
    const placeholderUser = placeholderStore.users.find((user) => user.email === email);
    assert.ok(placeholderUser);
    placeholderUser.passwordHash = "restored-from-signed-session";
    await writeFile(
      env.PLATFORM_STORE_PATH,
      `${JSON.stringify(placeholderStore, null, 2)}\n`,
      "utf8"
    );

    const recoveredSignup = await request("/api/auth", {
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
        password: "claimedpassword123",
      }),
    });
    assert.equal(recoveredSignup.status, 200);

    const recoveredLogin = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "login",
        role: "parent",
        email,
        password: "claimedpassword123",
      }),
    });
    assert.equal(recoveredLogin.status, 200);

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

    const signupCounterAdminLogin = await request("/api/auth", {
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
    assert.equal(signupCounterAdminLogin.status, 200);
    const signupCounterAdminCookie = cookieFrom(signupCounterAdminLogin);
    const signupCounterAdminDashboard = await request("/api/admin/verifications", {
      headers: { Cookie: signupCounterAdminCookie },
    });
    assert.equal(signupCounterAdminDashboard.status, 200);
    const signupCounterAdminDashboardPayload = await json(signupCounterAdminDashboard);
    assert.ok(signupCounterAdminDashboardPayload.stats.registeredProviders >= 1);
    assert.ok(signupCounterAdminDashboardPayload.stats.providerSignupsToday >= 1);
    assert.ok(signupCounterAdminDashboardPayload.stats.providerSignupsLast7Days >= 1);

    const starterDiscovery = await request("/api/providers?q=Integration%20Provider");
    assert.equal(starterDiscovery.status, 200);
    const starterDiscoveryPayload = await json(starterDiscovery);
    assert.equal(starterDiscoveryPayload.providers.length, 1);
    assert.equal(starterDiscoveryPayload.providers[0].name, "Integration Provider");
    assert.equal(starterDiscoveryPayload.providers[0].price, 0);

    const signupStore = JSON.parse(await readFile(env.PLATFORM_STORE_PATH, "utf8"));
    const signedUpProvider = signupStore.users.find((user) => user.email === email);
    assert.ok(signedUpProvider);
    delete signupStore.providerProfiles[signedUpProvider.id];
    await writeFile(
      env.PLATFORM_STORE_PATH,
      `${JSON.stringify(signupStore, null, 2)}\n`,
      "utf8"
    );

    const backfilledDiscovery = await request("/api/providers?q=Integration%20Provider");
    assert.equal(backfilledDiscovery.status, 200);
    const backfilledDiscoveryPayload = await json(backfilledDiscovery);
    assert.equal(backfilledDiscoveryPayload.providers.length, 1);
    assert.equal(backfilledDiscoveryPayload.providers[0].name, "Integration Provider");
    assert.ok(
      backfilledDiscoveryPayload.categories.find((category) => category.id === "schools").count >= 1
    );

    await rm(env.PLATFORM_STORE_PATH, { force: true });
    const restoredSession = await request("/api/auth", {
      headers: { Cookie: cookie },
    });
    assert.equal(restoredSession.status, 200);
    assert.equal((await json(restoredSession)).user.role, "provider");

    const loginAfterRestore = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "login",
        role: "provider",
        email,
        password: "password123",
      }),
    });
    assert.equal(loginAfterRestore.status, 200);

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
    const incompletePublishPayload = await json(incompletePublish);
    assert.equal(incompletePublishPayload.error, "Complete the highlighted fields before publishing.");
    assert.ok(
      incompletePublishPayload.publishRequirements.some(
        (issue) => issue.section === "Basic Info" && issue.field === "About / Description"
      )
    );
    assert.ok(
      incompletePublishPayload.publishRequirements.some(
        (issue) => issue.section === "Basic Info" && issue.field === "Services"
      )
    );
    assert.ok(
      incompletePublishPayload.publishRequirements.some(
        (issue) => issue.section === "Pricing" && issue.field === "Starting price"
      )
    );

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
          mission: "Help children grow with confidence.",
          vision: "A trusted early learning community.",
          values: "Safety, care, and curiosity.",
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

    const inquirySignup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "Integration Inquiry Parent",
        email: `inquiry-${Date.now()}@example.com`,
        password: "password123",
        location: "gaborone",
      }),
    });
    assert.equal(inquirySignup.status, 200);
    const inquiryCookie = cookieFrom(inquirySignup);
    const inquiryDraft = await request(
      `/api/messages?provider=${encodeURIComponent(profilePayload.publicId)}`,
      { headers: { Cookie: inquiryCookie } }
    );
    const inquiryDraftPayload = await json(inquiryDraft);
    const inquiryConversationId = inquiryDraftPayload.conversations[0].id;
    const inquiryMessage = await request("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: inquiryCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        conversationId: inquiryConversationId,
        providerId: profilePayload.publicId,
        text: "Do you have a Reception place available?",
      }),
    });
    assert.equal(inquiryMessage.status, 200);

    const providerInbox = await request("/api/messages", {
      headers: { Cookie: cookie },
    });
    assert.equal(providerInbox.status, 200);
    const providerInboxPayload = await json(providerInbox);
    assert.equal(providerInboxPayload.conversations.length, 1);
    assert.equal(providerInboxPayload.conversations[0].participant, "Integration Inquiry Parent");
    assert.equal(providerInboxPayload.conversations[0].messages[0].isOwn, false);

    const providerReply = await request("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        conversationId: inquiryConversationId,
        text: "Yes, please arrange a visit.",
      }),
    });
    assert.equal(providerReply.status, 200);
    assert.equal((await json(providerReply)).message.isOwn, true);

    const parentInbox = await request("/api/messages", {
      headers: { Cookie: inquiryCookie },
    });
    const parentInboxPayload = await json(parentInbox);
    assert.equal(parentInboxPayload.conversations[0].participant, "Integration Nursery");
    assert.equal(parentInboxPayload.conversations[0].messages[0].isOwn, true);
    assert.equal(parentInboxPayload.conversations[0].messages[1].isOwn, false);

    const publicPage = await request(`/provider/${profilePayload.publicId}`);
    assert.equal(publicPage.status, 200);
    assert.match(await publicPage.text(), /Integration Nursery/);

    const prematureSubmission = await request("/api/verifications", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(prematureSubmission.status, 400);

    const nannySignup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "provider",
        name: "Integration Nanny",
        email: `nanny-${Date.now()}@example.com`,
        password: "password123",
        category: "nannies",
        location: "gaborone",
      }),
    });
    assert.equal(nannySignup.status, 200);
    const nannyCookie = cookieFrom(nannySignup);
    const nannyProfile = await request("/api/profiles/provider", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: nannyCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        profile: {
          displayName: "Integration Nanny",
          category: "nannies",
          location: "Gaborone",
          bio: "Experienced household childcare provider.",
          phone: "+267 71 000 222",
          whatsapp: "+26771000222",
          services: ["Nanny care"],
          experience: "Five years",
          availability: "Weekdays",
          price: "3500",
          priceUnit: "monthly",
          published: false,
          liveIn: true,
          feeRows: [],
        },
      }),
    });
    assert.equal(nannyProfile.status, 200);
    const nannyPayment = await request("/api/verifications/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: nannyCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ packageId: "standard" }),
    });
    assert.equal(nannyPayment.status, 200);
    const nannyPaymentPayload = await json(nannyPayment);
    assert.equal(nannyPaymentPayload.payment.status, "paid");
    assert.equal(nannyPaymentPayload.payment.amount, 0);
    assert.equal(nannyPaymentPayload.payment.coveredByFreeAccess, true);
    assert.equal(nannyPaymentPayload.payment.packageId, "standard");

    const payment = await request("/api/verifications/payment", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(payment.status, 200);
    const paymentPayload = await json(payment);
    assert.equal(paymentPayload.payment.status, "paid");
    assert.equal(paymentPayload.payment.amount, 0);
    assert.equal(paymentPayload.payment.coveredByFreeAccess, true);
    assert.equal(paymentPayload.subscription.status, "active");

    const profileImageForm = new FormData();
    profileImageForm.set("type", "profile-image");
    profileImageForm.set("label", "Profile picture");
    profileImageForm.set("file", new Blob(["test profile image"], { type: "image/png" }), "profile.png");
    const profileImageUpload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: profileImageForm,
    });
    assert.equal(profileImageUpload.status, 200);

    const coverImageForm = new FormData();
    coverImageForm.set("type", "cover-image");
    coverImageForm.set("label", "Cover photo");
    coverImageForm.set("file", new Blob(["test cover image"], { type: "image/png" }), "cover.png");
    const coverImageUpload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: coverImageForm,
    });
    assert.equal(coverImageUpload.status, 200);

    const galleryForm = new FormData();
    galleryForm.set("type", "gallery");
    galleryForm.set("label", "School gallery photo");
    galleryForm.set("file", new Blob(["test gallery image"], { type: "image/png" }), "gallery.png");
    const galleryUpload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: galleryForm,
    });
    assert.equal(galleryUpload.status, 200);

    const identityForm = new FormData();
    identityForm.set("type", "document");
    identityForm.set("documentKey", "registration-certificate");
    identityForm.set("label", "Registration certificate");
    identityForm.set(
      "file",
      new Blob(["test registration"], { type: "application/pdf" }),
      "registration.pdf"
    );
    const identityUpload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: identityForm,
    });
    assert.equal(identityUpload.status, 200);

    const form = new FormData();
    form.set("type", "document");
    form.set("documentKey", "operating-documentation");
    form.set("label", "Relevant operating documentation");
    form.set("file", new Blob(["test document"], { type: "application/pdf" }), "operating.pdf");

    const upload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: form,
    });
    assert.equal(upload.status, 200);
    const uploadPayload = await json(upload);
    assert.equal(uploadPayload.upload.fileName, "operating.pdf");

    const prospectusForm = new FormData();
    prospectusForm.set("type", "document");
    prospectusForm.set("documentKey", "prospectus");
    prospectusForm.set("label", "Prospectus");
    prospectusForm.set(
      "file",
      new Blob(["test prospectus"], { type: "application/pdf" }),
      "prospectus.pdf"
    );
    const prospectusUpload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: prospectusForm,
    });
    assert.equal(prospectusUpload.status, 200);

    const representativeForm = new FormData();
    representativeForm.set("type", "document");
    representativeForm.set("documentKey", "representative-id");
    representativeForm.set("label", "Representative ID");
    representativeForm.set(
      "file",
      new Blob(["test representative"], { type: "application/pdf" }),
      "representative.pdf"
    );
    const representativeUpload = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: representativeForm,
    });
    assert.equal(representativeUpload.status, 200);

    const list = await request("/api/uploads", {
      headers: { Cookie: cookie },
    });
    assert.equal(list.status, 200);
    assert.equal((await json(list)).uploads.length, 7);

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
    const statusPayload = await json(status);
    assert.equal(statusPayload.status, "pending");
    assert.equal(statusPayload.payment.status, "paid");
    assert.equal(statusPayload.missingDocuments.length, 0);

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
    assert.equal(providerSubmission.verificationPayment.status, "paid");
    assert.equal(providerSubmission.uploads.length, 4);
    const adminDocument = await request(providerSubmission.uploads[0].url, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(adminDocument.status, 200);
    assert.equal(adminDocument.headers.get("content-type"), "application/pdf");

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

    const rejectedDocument = await request(providerSubmission.uploads[0].url, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(rejectedDocument.status, 404);

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
  it("switches active account type between parent and provider without losing provider data", async () => {
    const email = `switcher-${Date.now()}@example.com`;
    const signup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "Integration Switcher",
        email,
        password: "password123",
        location: "gaborone",
      }),
    });

    assert.equal(signup.status, 200);
    let cookie = cookieFrom(signup);
    const signupPayload = await json(signup);
    assert.equal(signupPayload.user.role, "parent");
    assert.deepEqual(signupPayload.user.roles, ["parent"]);

    const unauthSwitch = await request("/api/account/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ target: "provider" }),
    });
    assert.equal(unauthSwitch.status, 401);

    const crossOriginSwitch = await request("/api/account/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "https://attacker.example.com",
      },
      body: JSON.stringify({ target: "provider" }),
    });
    assert.equal(crossOriginSwitch.status, 403);

    const escalation = await request("/api/account/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ target: "admin" }),
    });
    assert.equal(escalation.status, 403);

    const stillParent = await json(
      await request("/api/auth", { headers: { Cookie: cookie } })
    );
    assert.equal(stillParent.user.role, "parent");

    const adminDashboard = await request("/api/admin/verifications", {
      headers: { Cookie: cookie },
    });
    assert.equal(adminDashboard.status, 401);

    const toProvider = await request("/api/account/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ target: "provider" }),
    });
    assert.equal(toProvider.status, 200);
    const providerCookie = cookieFrom(toProvider);
    const toProviderPayload = await json(toProvider);
    assert.equal(toProviderPayload.user.role, "provider");
    assert.deepEqual(toProviderPayload.user.roles.sort(), ["parent", "provider"]);

    const staleSession = await json(
      await request("/api/auth", { headers: { Cookie: cookie } })
    );
    assert.equal(staleSession.user, null);

    cookie = providerCookie;

    const providerProfile = await json(
      await request("/api/profiles/provider", { headers: { Cookie: cookie } })
    );
    assert.equal(providerProfile.profile.published, false);
    assert.equal(providerProfile.profile.verificationStatus, "not_submitted");

    const searchResults = await json(await request("/api/providers"));
    assert.equal(
      searchResults.providers.some((provider) => provider.email === email),
      false,
      "an unpublished switched provider must not appear in search"
    );

    const publish = await request("/api/profiles/provider", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        profile: {
          ...providerProfile.profile,
          displayName: "Switched Provider Listing",
          location: "gaborone",
          bio: "A provider listing created by switching account type.",
          phone: "+267 71 999 888",
          price: "1500",
          published: true,
        },
      }),
    });
    assert.equal(publish.status, 200);
    const publishPayload = await json(publish);
    assert.equal(publishPayload.profile.published, true);

    const backToParent = await request("/api/account/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ target: "parent" }),
    });
    assert.equal(backToParent.status, 200);
    cookie = cookieFrom(backToParent);
    const backToParentPayload = await json(backToParent);
    assert.equal(backToParentPayload.user.role, "parent");
    assert.deepEqual(backToParentPayload.user.roles.sort(), ["parent", "provider"]);

    const visibleWhileParentActive = await json(await request("/api/providers"));
    assert.equal(
      visibleWhileParentActive.providers.some(
        (provider) =>
          provider.email === email && provider.name === "Switched Provider Listing"
      ),
      true,
      "a published provider profile must remain visible even when parent is the active role"
    );

    // Provider-only write surfaces reject the account while parent is active.
    // (The provider profile GET is scoped to the caller's own record and is
    // not role-gated, so it stays readable by design.)
    const providerUploadBlocked = await request("/api/uploads", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
      body: new URLSearchParams({ type: "gallery" }),
    });
    assert.equal(providerUploadBlocked.status, 403);

    const providerVerificationBlocked = await request("/api/verifications", {
      headers: { Cookie: cookie },
    });
    assert.equal(providerVerificationBlocked.status, 401);

    const parentProfileAfterSwitch = await request("/api/profiles/parent", {
      headers: { Cookie: cookie },
    });
    assert.equal(parentProfileAfterSwitch.status, 200);

    const returnToProvider = await request("/api/account/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ target: "provider" }),
    });
    assert.equal(returnToProvider.status, 200);
    cookie = cookieFrom(returnToProvider);

    const preservedProfile = await json(
      await request("/api/profiles/provider", { headers: { Cookie: cookie } })
    );
    assert.equal(
      preservedProfile.profile.displayName,
      "Switched Provider Listing",
      "provider profile data must survive a switch away and back"
    );
    assert.equal(preservedProfile.profile.published, true);
  });

  it("renders the settings page with an account type switcher", async () => {
    const settingsPage = await request("/settings");
    assert.equal(settingsPage.status, 200);

    // The switcher is client-rendered once the session resolves, so assert the
    // route serves its pre-session shell and check the source for the control
    // itself (the same approach the /auth coverage above uses).
    assert.match(await settingsPage.text(), /Checking your account/);

    const settingsSource = await readFile(
      path.join(process.cwd(), "app", "settings", "page.tsx"),
      "utf8"
    );
    assert.match(settingsSource, /Account type/);
    assert.match(settingsSource, /\/api\/account\/role/);
    // Admin must never be offered as a self-service switch target. Assert on
    // the rendered option set itself, not on a call site that never exists.
    const switchableList = settingsSource.match(
      /\(\[([^\]]*)\] as SwitchableRole\[\]\)/
    );
    assert.ok(switchableList, "expected a typed switchable-role list to assert on");
    assert.equal(switchableList[1].includes("admin"), false);

    const routeSource = await readFile(
      path.join(process.cwd(), "app", "api", "account", "role", "route.ts"),
      "utf8"
    );
    const serverSwitchable = routeSource.match(/SWITCHABLE_ROLES: UserRole\[\] = \[([^\]]*)\]/);
    assert.ok(serverSwitchable, "expected SWITCHABLE_ROLES to assert on");
    assert.equal(serverSwitchable[1].includes("admin"), false);

    const navbarSource = await readFile(
      path.join(process.cwd(), "components", "Navbar.tsx"),
      "utf8"
    );
    assert.match(navbarSource, /href="\/settings"/);
  });

  it("keeps allowlisted admins out of the account type switcher", async () => {
    const email = "admin-test@example.com";
    const signup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "admin",
        name: "Admin Switch Guard",
        email,
        password: "password123",
      }),
    });
    assert.equal(signup.status, 200);
    const cookie = cookieFrom(signup);
    assert.equal((await json(signup)).user.role, "admin");

    const deskBefore = await request("/api/admin/verifications", {
      headers: { Cookie: cookie },
    });
    assert.equal(deskBefore.status, 200);

    // An admin must not be able to demote themselves: switching away would
    // revoke their admin sessions and leave no route back, since admin is not
    // a switchable target.
    for (const target of ["parent", "provider"]) {
      const attempt = await request("/api/account/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Origin: baseUrl,
        },
        body: JSON.stringify({ target }),
      });
      assert.equal(attempt.status, 400, `admin must not switch to ${target}`);
    }

    const stillAdmin = await json(
      await request("/api/auth", { headers: { Cookie: cookie } })
    );
    assert.equal(stillAdmin.user.role, "admin");

    const deskAfter = await request("/api/admin/verifications", {
      headers: { Cookie: cookie },
    });
    assert.equal(deskAfter.status, 200, "admin must keep verification desk access");
  });

  it("leaves exactly one live session after a no-op account type switch", async () => {
    const email = `noop-switch-${Date.now()}@example.com`;
    const signup = await request("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "No-op Switcher",
        email,
        password: "password123",
      }),
    });
    assert.equal(signup.status, 200);
    const originalCookie = cookieFrom(signup);

    // Switching to the role that is already active still rotates the session,
    // so a previously issued cookie must stop working.
    const noop = await request("/api/account/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: originalCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ target: "parent" }),
    });
    assert.equal(noop.status, 200);
    const rotatedCookie = cookieFrom(noop);
    assert.notEqual(rotatedCookie, originalCookie);

    const withOldCookie = await json(
      await request("/api/auth", { headers: { Cookie: originalCookie } })
    );
    assert.equal(withOldCookie.user, null, "the superseded cookie must be revoked");

    const withNewCookie = await json(
      await request("/api/auth", { headers: { Cookie: rotatedCookie } })
    );
    assert.equal(withNewCookie.user.role, "parent");
    assert.deepEqual(withNewCookie.user.roles, ["parent"]);
  });

});
