import { NextResponse } from "next/server";
import {
  decideVerification,
  getSessionFromRequest,
  readStore,
} from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const auth = await getSessionFromRequest(request);
  return auth?.session.role === "admin" ? auth : null;
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
  return NextResponse.json(store.verifications);
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

  return NextResponse.json(await decideVerification(String(body.id), action));
}
