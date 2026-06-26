import { NextResponse } from "next/server";
import { getCategoryById, getProviderById } from "@/lib/platform-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const provider = getProviderById(id);

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json({
    provider,
    category: getCategoryById(provider.category),
  });
}
