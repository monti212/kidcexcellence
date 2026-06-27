import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  readStore,
  submitProviderVerification,
} from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth || auth.user.role !== "provider") {
    return NextResponse.json({ error: "Provider authentication required" }, { status: 401 });
  }

  const store = await readStore();
  const profile = store.providerProfiles[auth.session.userId];
  const pending = store.verifications.pendingProviders.find(
    (item) => item.userId === auth.session.userId
  );
  const approved = store.verifications.approvedProviders.find(
    (item) => item.userId === auth.session.userId
  );

  return NextResponse.json({
    status: profile?.verificationStatus ?? "not_submitted",
    pending: pending ?? null,
    approved: approved ?? null,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth || auth.user.role !== "provider") {
    return NextResponse.json({ error: "Provider authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `provider-verification:${auth.session.userId}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many verification submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const submission = await submitProviderVerification(auth.session.userId);
    return NextResponse.json({ submission, status: "pending" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit verification." },
      { status: 400 }
    );
  }
}
