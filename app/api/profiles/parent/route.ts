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
  if (!auth || auth.user.role !== "parent") {
    return NextResponse.json({ error: "Parent authentication required" }, { status: 401 });
  }

  const userId = auth.session.userId;
  const store = await readStore();

  return NextResponse.json({
    profile: userId ? store.parentProfiles[userId] ?? null : null,
    user: auth.user,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth || auth.user.role !== "parent") {
    return NextResponse.json({ error: "Parent authentication required" }, { status: 401 });
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

  if (!body?.profile || !Array.isArray(body.profile.children)) {
    return NextResponse.json(
      { error: "A valid parent profile is required" },
      { status: 400 }
    );
  }

  const fullName = String(body.profile.fullName ?? "").trim();
  const phone = String(body.profile.phone ?? "").trim();
  const location = String(body.profile.location ?? "").trim();
  if (!fullName || !phone || !location) {
    return NextResponse.json(
      { error: "Full name, phone number, and location are required" },
      { status: 400 }
    );
  }

  const result = await saveParentProfile(userId, {
    fullName,
    dateOfBirth: String(body.profile.dateOfBirth ?? "").trim(),
    nationality: String(body.profile.nationality ?? "").trim(),
    location,
    phone,
    bio: String(body.profile.bio ?? "").trim(),
    children: body.profile.children.map((child: ChildProfile) => ({
      id: String(child.id),
      name: String(child.name ?? "").trim(),
      dob: String(child.dob ?? "").trim(),
      specialNeeds: String(child.specialNeeds ?? "").trim(),
    })),
  });
  return NextResponse.json(result);
}
