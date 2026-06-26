import { NextResponse } from "next/server";
import { createOrLoginUser, type UserRole } from "@/lib/platform-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mode = body?.mode === "login" ? "login" : "signup";
  const role: UserRole = body?.role === "provider" ? "provider" : "parent";
  const email = typeof body?.email === "string" ? body.email : "";

  if (!email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const user = await createOrLoginUser({
    mode,
    role,
    name: typeof body?.name === "string" ? body.name : undefined,
    email,
    phone: typeof body?.phone === "string" ? body.phone : undefined,
    location: typeof body?.location === "string" ? body.location : undefined,
    category: typeof body?.category === "string" ? body.category : undefined,
  });

  return NextResponse.json({
    user,
    session: {
      userId: user.id,
      role: user.role,
      createdAt: new Date().toISOString(),
    },
  });
}
