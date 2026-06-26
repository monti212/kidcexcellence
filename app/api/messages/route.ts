import { NextResponse } from "next/server";
import {
  appendConversationMessage,
  getStoredConversations,
} from "@/lib/platform-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    conversations: await getStoredConversations(searchParams.get("provider")),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.conversationId || !body?.text) {
    return NextResponse.json(
      { error: "conversationId and text are required" },
      { status: 400 }
    );
  }

  const result = await appendConversationMessage({
    conversationId: String(body.conversationId),
    text: String(body.text),
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
