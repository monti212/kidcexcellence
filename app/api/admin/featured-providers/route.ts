import { accountProvidersFromStore } from "@/lib/platform-service";
import {
  getSessionFromRequest,
  readStore,
} from "@/lib/platform-store";
import { isSameOriginMutation } from "@/lib/request-guard";

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
}

const featuredStore = new Map<string, { featured: boolean; expiresAt?: Date }>();

async function requireAdmin(request: Request) {
  const auth = await getSessionFromRequest(request);
  return auth?.session.role === "admin" ? auth : null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) {
      return Response.json({ error: "Admin authentication required" }, { status: 401 });
    }

    const store = await readStore();
    const providers: FeaturedProviderResponse[] = accountProvidersFromStore(store).map((p) => {
      const featuredData = featuredStore.get(p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        rating: p.rating,
        verified: p.verified,
        featured: featuredData?.featured ?? false,
        promotionExpiresAt: featuredData?.expiresAt?.toISOString(),
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
    if (!isSameOriginMutation(request)) {
      return Response.json({ error: "Cross-origin request rejected" }, { status: 403 });
    }

    const auth = await requireAdmin(request);
    if (!auth) {
      return Response.json({ error: "Admin authentication required" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const { action, providerIds } = body;

    if (!action || !Array.isArray(providerIds)) {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (action === "promote") {
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
