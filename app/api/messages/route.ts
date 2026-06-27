import { NextResponse } from "next/server";
import {
  appendConversationMessage,
  getSessionFromRequest,
  getStoredConversations,
} from "@/lib/platform-store";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth || !["parent", "provider"].includes(auth.user.role)) {
    return NextResponse.json({ error: "Account authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    conversations: await getStoredConversations(
      auth.session.userId,
      auth.user.role,
      searchParams.get("provider")
    ),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth || !["parent", "provider"].includes(auth.user.role)) {
    return NextResponse.json({ error: "Account authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `messages:${auth.session.userId}:${requestIp(request)}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);

  const text = String(body?.text ?? "").trim();
  if (!body?.conversationId || !text) {
    return NextResponse.json(
      { error: "conversationId and text are required" },
      { status: 400 }
    );
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Messages must be 2,000 characters or fewer" }, { status: 400 });
  }

  const result = await appendConversationMessage({
    viewerUserId: auth.session.userId,
    viewerRole: auth.user.role,
    conversationId: String(body.conversationId),
    text,
    providerId: typeof body.providerId === "string" ? body.providerId : undefined,
  });

  if (!result.conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    message: result.message,
    conversation: result.conversation,
  });
}
