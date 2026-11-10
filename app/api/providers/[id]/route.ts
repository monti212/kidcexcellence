import { NextResponse } from "next/server";
import {
  allProvidersFromStore,
  getCategoryById,
} from "@/lib/platform-service";
import { readStore } from "@/lib/platform-store";
import { withPersistenceErrors } from "@/lib/persistence-errors";

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = await readStore();
  const provider = allProvidersFromStore(store).find((item) => item.id === id);

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json({
    provider,
    category: getCategoryById(provider.category),
  });
}

export const GET = withPersistenceErrors(handleGET);
