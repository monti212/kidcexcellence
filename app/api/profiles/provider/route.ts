import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  readStore,
  saveProviderProfile,
} from "@/lib/platform-store";
import { providerIsApproved } from "@/lib/platform-service";
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
  const profile = userId ? store.providerProfiles[userId] ?? null : null;
  const displayName = profile?.displayName || auth.user.name;

  return NextResponse.json({
    profile,
    verified: providerIsApproved(store.verifications.approvedProviders, displayName),
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

  const requestedPublish = Boolean(body.profile.published);
  const normalized = {
    displayName: String(body.profile.displayName ?? auth.user.name).trim(),
    category: String(body.profile.category ?? "schools"),
    location: String(body.profile.location ?? auth.user.location ?? "").trim(),
    bio: String(body.profile.bio ?? "").trim(),
    phone: String(body.profile.phone ?? auth.user.phone ?? "").trim(),
    whatsapp: String(body.profile.whatsapp ?? body.profile.phone ?? "").trim(),
    services: Array.isArray(body.profile.services)
      ? body.profile.services
          .map(String)
          .map((item: string) => item.trim())
          .filter(Boolean)
      : [],
    experience: String(body.profile.experience ?? "").trim(),
    availability: String(body.profile.availability ?? "").trim(),
    price: String(body.profile.price ?? "").trim(),
    priceUnit: ["monthly", "per day", "per hour", "termly"].includes(body.profile.priceUnit)
      ? (body.profile.priceUnit as "monthly" | "per day" | "per hour" | "termly")
      : "termly",
    liveIn: Boolean(body.profile.liveIn),
    published: requestedPublish,
    feeRows: Array.isArray(body.profile.feeRows)
      ? body.profile.feeRows.map((row: unknown) => {
          const item = row as Record<string, unknown>;
          return {
            grade: String(item.grade ?? "").trim(),
            termly: String(item.termly ?? "").trim(),
            annually: String(item.annually ?? "").trim(),
          };
        })
      : [],
  };

  if (
    requestedPublish &&
    (!normalized.displayName ||
      !normalized.location ||
      !normalized.bio ||
      !normalized.phone ||
      normalized.services.length === 0 ||
      (normalized.feeRows.every((row: { termly: string }) => !Number(row.termly)) &&
        !Number(normalized.price)))
  ) {
    return NextResponse.json(
      {
        error:
          "Complete the public details, at least one service, and a starting price before publishing.",
      },
      { status: 400 }
    );
  }

  const profile = await saveProviderProfile(userId, normalized);
  const store = await readStore();

  return NextResponse.json({
    profile,
    verified: providerIsApproved(
      store.verifications.approvedProviders,
      profile.displayName || auth.user.name
    ),
    publicId: profile.published ? `account-${userId}` : null,
  });
}
