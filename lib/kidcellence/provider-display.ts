import type { IconName } from "@/components/kidcellence/Icon";
import type { Provider } from "@/lib/mock-data";
import { getCategoryLabel } from "@/lib/platform-service";

// Design icon for each real category id (lib/mock-data.ts CATEGORIES).
export const CATEGORY_ICONS: Record<string, IconName> = {
  nannies: "nanny",
  babysitters: "babysitter",
  helpers: "helper",
  schools: "school",
  nurseries: "nursery",
  tutors: "tutor",
  "after-school": "afterSchool",
  "pediatric-clinics": "pediatrician",
  "child-psychologists": "psychologist",
  "pediatric-therapy": "therapy",
  "kiddies-transport": "transport",
  "kiddies-parties": "parties",
  "kiddies-entertainment": "entertainment",
  agencies: "agency",
};

export function categoryIcon(categoryId: string): IconName {
  return CATEGORY_ICONS[categoryId] ?? "shieldCheck";
}

// The four card tints from the design, picked stably from the provider id so a
// listing keeps its colour between visits.
const TINTS = ["#54b2bf", "#ffcc2f", "#f05a3c", "#d7edf0"] as const;

export function providerTint(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

/** "Verified · Nanny" for verified listings, the category alone otherwise. */
export function providerBadgeLine(provider: Pick<Provider, "verified" | "category">) {
  const label = getCategoryLabel(provider.category);
  return provider.verified ? `Verified · ${label}` : label;
}

export function formatPrice(provider: Pick<Provider, "price" | "priceUnit">) {
  if (!provider.price || provider.price <= 0) return "Contact for pricing";
  return `P${provider.price.toLocaleString("en-BW")} ${provider.priceUnit === "monthly" ? "/month" : provider.priceUnit === "termly" ? "/term" : provider.priceUnit}`;
}

/**
 * The provider's own uploaded photo, or null. Accounts without one get a
 * generated dicebear placeholder URL from buildAccountProvider; the design shows
 * initials instead, so only real uploads are returned.
 */
export function providerPhoto(provider: Pick<Provider, "image">) {
  const src = provider.image?.trim();
  return src && src.startsWith("/api/uploads/") ? src : null;
}
