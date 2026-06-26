import { NextResponse } from "next/server";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/platform-store";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const rateLimit = consumeRateLimit({
    key: `password-reset:${requestIp(request)}:${email || token.slice(0, 12) || "unknown"}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many password reset requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  if (token) {
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const user = await resetPasswordWithToken(token, password);
    if (!user) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }
    return NextResponse.json({ user, reset: true });
  }

  if (!email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const result = await requestPasswordReset(email);

  return NextResponse.json({
    ok: true,
    delivery: result?.token
      ? {
          mode: "development",
          token: result.token,
          message: "Email delivery is not configured yet. Use this token in development.",
        }
      : null,
  });
}
