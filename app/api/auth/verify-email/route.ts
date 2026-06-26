import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  requestEmailVerification,
  verifyEmailToken,
} from "@/lib/platform-store";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  const body = await request.json().catch(() => null);
  const email =
    auth?.user.email ??
    (typeof body?.email === "string" ? body.email.trim().toLowerCase() : "");
  const token = typeof body?.token === "string" ? body.token : "";

  const rateLimit = consumeRateLimit({
    key: `verify-email:${requestIp(request)}:${email || "unknown"}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many verification requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  if (token) {
    const user = await verifyEmailToken(token);
    if (!user) {
      return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
    }
    return NextResponse.json({ user, verified: true });
  }

  if (!email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const result = await requestEmailVerification(email);

  return NextResponse.json({
    ok: true,
    alreadyVerified: result?.alreadyVerified ?? false,
    delivery: result?.token
      ? {
          mode: "development",
          token: result.token,
          message: "Email delivery is not configured yet. Use this token in development.",
        }
      : null,
  });
}
