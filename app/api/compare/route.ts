import { NextResponse } from "next/server";
import { allProvidersFromStore } from "@/lib/platform-service";
import { readStore } from "@/lib/platform-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);
  const store = await readStore();
  const providers = allProvidersFromStore(store);

  return NextResponse.json({
    ids,
    providers: ids
      .map((id) => providers.find((provider) => provider.id === id))
      .filter(Boolean),
  });
}
