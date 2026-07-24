import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  recordVerificationPayment,
} from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";
import { VERIFICATION_FEE } from "@/lib/verification-requirements";
import { VETTING_PACKAGES } from "@/lib/vetting-packages";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ fee: VERIFICATION_FEE, packages: VETTING_PACKAGES });
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
    key: `provider-verification-payment:${auth.session.userId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const payment = await recordVerificationPayment(
      auth.session.userId,
      typeof body?.packageId === "string" ? body.packageId : undefined
    );
    return NextResponse.json({ payment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record verification payment." },
      { status: 400 }
    );
  }
}
