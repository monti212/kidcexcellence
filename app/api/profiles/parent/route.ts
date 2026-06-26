import { NextResponse } from "next/server";
import { readStore, saveParentProfile, type ChildProfile } from "@/lib/platform-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const store = await readStore();

  return NextResponse.json({
    profile: userId ? store.parentProfiles[userId] ?? null : null,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.userId || !Array.isArray(body?.children)) {
    return NextResponse.json(
      { error: "userId and children are required" },
      { status: 400 }
    );
  }

  const children = body.children.map((child: ChildProfile) => ({
    id: String(child.id),
    name: String(child.name ?? ""),
    dob: String(child.dob ?? ""),
    specialNeeds: String(child.specialNeeds ?? ""),
  }));

  const profile = await saveParentProfile(String(body.userId), children);
  return NextResponse.json({ profile });
}
