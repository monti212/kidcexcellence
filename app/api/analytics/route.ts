import { NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";
import { recordPlatformPageView } from "@/lib/platform-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";

  const rateLimit = consumeRateLimit({
    key: `platform-analytics:${requestIp(request)}:${visitorId || "anonymous"}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many analytics events. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  await recordPlatformPageView({ visitorId, pathname });
  return NextResponse.json({ ok: true });
}
