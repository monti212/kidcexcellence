import { NextResponse } from "next/server";
import { decideVerification, readStore } from "@/lib/platform-store";

export const runtime = "nodejs";

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store.verifications);
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action === "reject" ? "reject" : "approve";

  if (!body?.id) {
    return NextResponse.json({ error: "Verification id is required" }, { status: 400 });
  }

  return NextResponse.json(await decideVerification(String(body.id), action));
}
