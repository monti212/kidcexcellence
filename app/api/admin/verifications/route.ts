import { NextResponse } from "next/server";
import {
  decideVerification,
  getSessionFromRequest,
  readStore,
} from "@/lib/platform-store";
import { allProvidersFromStore } from "@/lib/platform-service";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const auth = await getSessionFromRequest(request);
  return auth?.session.role === "admin" ? auth : null;
}

function dashboardPayload(
  store: Awaited<ReturnType<typeof readStore>>,
  admin: { name: string; email: string }
) {
  return {
    ...store.verifications,
    pendingProviders: store.verifications.pendingProviders.map((pending) => ({
      ...pending,
      uploads: pending.userId
        ? store.uploads
            .filter(
              (upload) =>
                upload.userId === pending.userId && upload.type === "document"
            )
            .map((upload) => ({
              id: upload.id,
              label: upload.label,
              fileName: upload.fileName,
              contentType: upload.contentType,
              size: upload.size,
              url: `/api/uploads/${upload.id}`,
            }))
        : [],
    })),
    stats: {
      totalProviders: allProvidersFromStore(store).length,
      totalParents: store.users.filter((user) => user.role === "parent").length,
      registeredProviders: store.users.filter((user) => user.role === "provider").length,
    },
    admin,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `admin-verifications:${auth.session.userId}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many admin requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const store = await readStore();
  return NextResponse.json(dashboardPayload(store, auth.user));
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `admin-verification-mutation:${auth.session.userId}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many admin actions. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  const action = body?.action === "reject" ? "reject" : "approve";

  if (!body?.id) {
    return NextResponse.json({ error: "Verification id is required" }, { status: 400 });
  }

  await decideVerification(String(body.id), action);
  const store = await readStore();
  return NextResponse.json(dashboardPayload(store, auth.user));
}
