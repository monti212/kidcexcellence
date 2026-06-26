import { NextResponse } from "next/server";
import { readStore, saveProviderProfile } from "@/lib/platform-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const store = await readStore();

  return NextResponse.json({
    profile: userId ? store.providerProfiles[userId] ?? null : null,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.userId || !body?.profile) {
    return NextResponse.json(
      { error: "userId and profile are required" },
      { status: 400 }
    );
  }

  const profile = await saveProviderProfile(String(body.userId), {
    category: String(body.profile.category ?? "schools"),
    liveIn: Boolean(body.profile.liveIn),
    feeRows: Array.isArray(body.profile.feeRows) ? body.profile.feeRows : [],
  });

  return NextResponse.json({ profile });
}
