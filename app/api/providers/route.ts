import { NextResponse } from "next/server";
import {
  filterProviders,
  getCategories,
  type ProviderSort,
} from "@/lib/platform-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categories = searchParams.getAll("category");
  const sortBy = searchParams.get("sort") as ProviderSort | null;
  const maxPriceParam = searchParams.get("maxPrice");
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;

  return NextResponse.json({
    categories: getCategories(),
    providers: filterProviders({
      q: searchParams.get("q") ?? undefined,
      categories,
      location: searchParams.get("location") ?? undefined,
      maxPrice: maxPrice && Number.isFinite(maxPrice) ? maxPrice : undefined,
      verifiedOnly: searchParams.get("verified") === "true",
      sortBy: sortBy ?? undefined,
    }),
  });
}
