import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  recordProviderProfileView,
} from "@/lib/platform-store";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";
import { withPersistenceErrors } from "@/lib/persistence-errors";

export const runtime = "nodejs";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const { id } = await params;
  const rateLimit = consumeRateLimit({
    key: `provider-analytics:${requestIp(request)}:${id}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many analytics events. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  if (body?.event !== "profile-view") {
    return NextResponse.json({ error: "Unsupported analytics event" }, { status: 400 });
  }

  const auth = await getSessionFromRequest(request);
  await recordProviderProfileView(id, auth?.session.userId);
  return NextResponse.json({ ok: true });
}

export const POST = withPersistenceErrors(handlePOST);
