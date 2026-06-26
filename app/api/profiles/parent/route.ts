import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  readStore,
  saveParentProfile,
  type ChildProfile,
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
    profile: userId ? store.parentProfiles[userId] ?? null : null,
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
    key: `profile-parent:${auth.session.userId}`,
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

  if (!Array.isArray(body?.children)) {
    return NextResponse.json(
      { error: "children are required" },
      { status: 400 }
    );
  }

  const children = body.children.map((child: ChildProfile) => ({
    id: String(child.id),
    name: String(child.name ?? ""),
    dob: String(child.dob ?? ""),
    specialNeeds: String(child.specialNeeds ?? ""),
  }));

  const profile = await saveParentProfile(userId, children);
  return NextResponse.json({ profile });
}
