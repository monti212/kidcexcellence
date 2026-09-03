import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { once } from "node:events";
import assert from "node:assert/strict";

const port = Number(process.env.TEST_PORT ?? 3210);
const baseUrl = `http://localhost:${port}`;
const tmpRoot = await mkdtemp(path.join(tmpdir(), "kidcellence-test-"));
const env = {
  ...process.env,
  ADMIN_EMAILS: "admin-test@example.com",
  ENABLE_DEMO_PROVIDERS: "true",
  // Keep the suite hermetic: a configured .env.local must not point these
  // writes at the live Supabase project.
  PLATFORM_STORE_DRIVER: "json",
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

// A response whose body is never read keeps its undici socket open, so the
// process never exits and node --test reports "Promise resolution is still
// pending but the event loop has already resolved". Most assertions here only
// check status, so leftovers are drained in after() rather than at each call.
const openResponses = new Set();

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  openResponses.add(response);
  return response;
}

async function drainOpenResponses() {
  for (const response of openResponses) {
    if (!response.bodyUsed) await response.arrayBuffer().catch(() => {});
  }
  openResponses.clear();
}

async function waitForServer() {
  const started = Date.now();
  let lastError;

  // A cold start with no .next cache compiles the whole app first, which
  // takes well over 30s on a modest machine.
  while (Date.now() - started < 180000) {
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
    // `npm run dev` spawns next, which spawns next-server. Making the child a
    // process-group leader lets after() signal the whole tree; killing only npm
    // orphans the grandchildren and leaves their stdio pipes open here, which
    // keeps the event loop alive and stops node --test from ever exiting.
    detached: true,
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
  // Drain before killing the server: reads from a dead socket just reject.
  await drainOpenResponses();

  if (server?.pid && !server.killed) {
    const exited = once(server, "exit");
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
    // Do not wait forever on a server that ignores SIGTERM.
    const deadline = new Promise((resolve) => setTimeout(resolve, 5000).unref());
    await Promise.race([exited, deadline]);
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }

  // The pipes are what actually hold the event loop open.
  server?.stdout?.destroy();
  server?.stderr?.destroy();

  await rm(tmpRoot, { recursive: true, force: true });
});

describe("Kidcellence platform APIs", () => {
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
    // Every provider should be represented in exactly one category facet, with
    // one known exception: "nurseries" is excluded from CORE_SERVICE_CATEGORIES
    // because it also exists as a subcategory of "schools", and it is not in
    // additionalCategories either. Nursery providers therefore appear in no
    // facet and cannot be found by browsing categories — a real gap, tracked in
    // the README rather than papered over here.
    const facetedProviders = providerIndexPayload.providers.filter(
      (provider) => provider.category !== "nurseries"
    ).length;
    assert.equal(
      [...providerIndexPayload.categories, ...providerIndexPayload.additionalCategories].reduce(
        (total, category) => total + category.count,
        0
      ),
      facetedProviders
    );
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
    assert.equal(queuePayload.pendingProviders.length, 0);
    assert.ok(queuePayload.stats.totalProviders > 0);
    assert.ok(queuePayload.stats.totalParents > 0);
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

    const starterDiscovery = await request("/api/providers?q=Integration%20Provider");
    assert.equal(starterDiscovery.status, 200);
    const starterDiscoveryPayload = await json(starterDiscovery);
    assert.equal(starterDiscoveryPayload.providers.length, 1);
    assert.equal(starterDiscoveryPayload.providers[0].name, "Integration Provider");
    assert.equal(starterDiscoveryPayload.providers[0].price, 0);

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
          // Required for school categories by missingVerificationProfileFields().
          mission: "Help every child arrive ready to learn.",
          vision: "A confident start for every family in Botswana.",
          values: "Safety, warmth, and steady communication.",
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
    assert.equal(nannyPaymentPayload.payment.amount, 795);
    assert.equal(nannyPaymentPayload.payment.packageName, "Standard");

    // A vetting package is an upgrade, not a requirement: a care worker who
    // picks no package pays the plain P20 care-worker verification fee.
    const soloSignup = await request("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({
        mode: "signup",
        role: "provider",
        name: "Integration Solo Nanny",
        email: `solo-nanny-${Date.now()}@example.com`,
        password: "password123",
        category: "nannies",
        location: "gaborone",
      }),
    });
    assert.equal(soloSignup.status, 200);
    const soloCookie = cookieFrom(soloSignup);
    await soloSignup.text();

    const soloProfile = await request("/api/profiles/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: soloCookie, Origin: baseUrl },
      body: JSON.stringify({
        profile: {
          displayName: "Integration Solo Nanny",
          category: "nannies",
          location: "Gaborone",
          bio: "Care provider paying the plain verification fee.",
          phone: "+267 71 000 333",
          whatsapp: "+26771000333",
          services: ["Nanny care"],
          experience: "Three years",
          availability: "Weekdays",
          price: "3000",
          priceUnit: "monthly",
          published: false,
          feeRows: [],
        },
      }),
    });
    assert.equal(soloProfile.status, 200);
    await soloProfile.text();

    const soloPayment = await request("/api/verifications/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: soloCookie, Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert.equal(soloPayment.status, 200);
    const soloPaymentPayload = await json(soloPayment);
    assert.equal(soloPaymentPayload.payment.amount, 20);
    assert.equal(soloPaymentPayload.payment.packageId, undefined);

    const payment = await request("/api/verifications/payment", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(payment.status, 200);
    const paymentPayload = await json(payment);
    assert.equal(paymentPayload.payment.status, "paid");
    // Nurseries are an organisation category: P50, per /pricing.
    assert.equal(paymentPayload.payment.amount, 50);

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

    // Beyond documents, missingVerificationProfileFields() requires a display
    // picture, a cover photo, and at least one gallery image before a school
    // may submit for verification.
    for (const [type, label, fileName] of [
      ["profile-image", "Display picture", "display.png"],
      ["cover-image", "Cover photo", "cover.png"],
      ["gallery", "Classroom", "classroom.png"],
    ]) {
      const imageForm = new FormData();
      imageForm.set("type", type);
      imageForm.set("label", label);
      imageForm.set("file", new Blob(["test image"], { type: "image/png" }), fileName);
      const imageUpload = await request("/api/uploads", {
        method: "POST",
        headers: { Cookie: cookie, Origin: baseUrl },
        body: imageForm,
      });
      assert.equal(imageUpload.status, 200, `${type} upload failed`);
      await imageUpload.text();
    }

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

  it("exposes billing state per account and refuses unverified payment writes", async () => {
    // The suite runs without STRIPE_SECRET_KEY, so this exercises the
    // unconfigured paths: they must fail closed rather than grant paid status.
    const anonymous = await request("/api/billing");
    assert.equal(anonymous.status, 401);
    await anonymous.text();

    const anonymousAdmin = await request("/api/admin/billing");
    assert.equal(anonymousAdmin.status, 401);
    await anonymousAdmin.text();

    const email = `billing-parent-${Date.now()}@example.com`;
    const signup = await request("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({
        mode: "signup",
        role: "parent",
        name: "Billing Parent",
        email,
        password: "password123",
        location: "gaborone",
      }),
    });
    assert.equal(signup.status, 200);
    const cookie = cookieFrom(signup);

    const billing = await request("/api/billing", { headers: { Cookie: cookie } });
    assert.equal(billing.status, 200);
    const billingPayload = await json(billing);
    // A parent account resolves to the parent plan at the /pricing rate.
    assert.equal(billingPayload.plan.id, "parent");
    assert.equal(billingPayload.plan.price, 60);
    assert.equal(billingPayload.subscription, null);
    assert.deepEqual(billingPayload.payments, []);
    assert.equal(billingPayload.billingEnabled, false);

    // Checkout must refuse rather than silently succeed when Stripe is absent.
    const checkout = await request("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert.equal(checkout.status, 503);
    await checkout.text();

    // Cross-origin writes stay blocked on the billing routes too.
    const crossOrigin = await request("/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "https://attacker.example",
      },
      body: JSON.stringify({}),
    });
    assert.equal(crossOrigin.status, 403);
    await crossOrigin.text();

    const portal = await request("/api/billing/portal", {
      method: "POST",
      headers: { Cookie: cookie, Origin: baseUrl },
    });
    assert.equal(portal.status, 503);
    await portal.text();

    const billingPage = await request("/billing");
    assert.equal(billingPage.status, 200);
    await billingPage.text();
  });

  it("rejects unsigned Stripe webhook deliveries", async () => {
    // Without STRIPE_WEBHOOK_SECRET the route must fail closed: it is the only
    // writer of paid state, so an unverified payload can never be trusted.
    const unsigned = await request("/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "evt_forged",
        type: "checkout.session.completed",
        data: { object: { id: "cs_forged", mode: "payment", payment_status: "paid" } },
      }),
    });
    assert.equal(unsigned.status, 503);
    assert.match((await json(unsigned)).error, /webhook secret/i);
  });
});
