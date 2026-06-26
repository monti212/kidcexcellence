import { NextResponse } from "next/server";
import { getProvidersByIds } from "@/lib/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);

  return NextResponse.json({
    ids,
    providers: getProvidersByIds(ids),
  });
}
