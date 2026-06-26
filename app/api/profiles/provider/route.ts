import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  readStore,
  saveProviderProfile,
} from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = auth.session.userId;
  const store = await readStore();

  return NextResponse.json({
    profile: userId ? store.providerProfiles[userId] ?? null : null,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `profile-provider:${auth.session.userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many profile updates. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  const userId = String(body?.userId ?? auth.session.userId);

  if (userId !== auth.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!body?.profile) {
    return NextResponse.json(
      { error: "profile is required" },
      { status: 400 }
    );
  }

  const profile = await saveProviderProfile(userId, {
    category: String(body.profile.category ?? "schools"),
    liveIn: Boolean(body.profile.liveIn),
    feeRows: Array.isArray(body.profile.feeRows) ? body.profile.feeRows : [],
  });

  return NextResponse.json({ profile });
}
