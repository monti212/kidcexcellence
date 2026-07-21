import { PROVIDERS } from "@/lib/mock-data";

interface RequestBody {
  action: "promote" | "demote";
  providerIds: string[];
}

interface FeaturedProviderResponse {
  id: string;
  name: string;
  category: string;
  rating: number;
  verified: boolean;
  featured: boolean;
  promotionExpiresAt?: string;
  fee?: number;
}

// In-memory store for featured status (in production, use a database)
const featuredStore = new Map<string, { featured: boolean; expiresAt?: Date }>();

// Initialize with providers marked as featured in mock-data
PROVIDERS.forEach((p) => {
  if (p.featured) {
    featuredStore.set(p.id, {
      featured: true,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    });
  }
});

export async function GET() {
  try {
    const providers: FeaturedProviderResponse[] = PROVIDERS.map((p) => {
      const featuredData = featuredStore.get(p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        rating: p.rating,
        verified: p.verified,
        featured: featuredData?.featured ?? p.featured ?? false,
        promotionExpiresAt: featuredData?.expiresAt?.toISOString(),
        fee: 500, // Mock pricing per month
      };
    });

    return Response.json({ providers });
  } catch (error) {
    console.error("Failed to load providers:", error);
    return Response.json(
      { error: "Failed to load providers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, providerIds } = body;

    if (!action || !Array.isArray(providerIds)) {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (action === "promote") {
      // Set featured status for 90 days
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      providerIds.forEach((id) => {
        featuredStore.set(id, { featured: true, expiresAt });
      });

      return Response.json({
        message: `${providerIds.length} provider(s) promoted successfully for 90 days`,
        action: "promote",
        count: providerIds.length,
      });
    } else if (action === "demote") {
      // Remove featured status
      providerIds.forEach((id) => {
        featuredStore.delete(id);
      });

      return Response.json({
        message: `${providerIds.length} provider(s) demoted successfully`,
        action: "demote",
        count: providerIds.length,
      });
    } else {
      return Response.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Failed to update featured providers:", error);
    return Response.json(
      { error: "Failed to update featured providers" },
      { status: 500 }
    );
  }
}
