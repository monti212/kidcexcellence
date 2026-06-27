import { NextResponse } from "next/server";
import {
  allProvidersFromStore,
  filterProviderList,
  getCategories,
  type ProviderSort,
} from "@/lib/platform-service";
import { readStore } from "@/lib/platform-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categories = searchParams.getAll("category");
  const sortBy = searchParams.get("sort") as ProviderSort | null;
  const maxPriceParam = searchParams.get("maxPrice");
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;
  const store = await readStore();
  const allProviders = allProvidersFromStore(store);

  return NextResponse.json({
    categories: getCategories().map((category) => ({
      ...category,
      count: allProviders.filter((provider) => provider.category === category.id).length,
    })),
    providers: filterProviderList(allProviders, {
      q: searchParams.get("q") ?? undefined,
      categories,
      location: searchParams.get("location") ?? undefined,
      maxPrice: maxPrice && Number.isFinite(maxPrice) ? maxPrice : undefined,
      verifiedOnly: searchParams.get("verified") === "true",
      sortBy: sortBy ?? undefined,
    }),
  });
}
