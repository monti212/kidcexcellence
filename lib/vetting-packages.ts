export type VettingPackageId = "standard" | "vip";

export interface VettingPackage {
  id: VettingPackageId;
  name: string;
  price: number;
  currency: "BWP";
  summary: string;
  features: string[];
}

export const VETTING_PACKAGE_CATEGORIES = new Set([
  "nannies",
  "helpers",
  "babysitters",
]);

export const VETTING_PACKAGES: VettingPackage[] = [
  {
    id: "standard",
    name: "Standard",
    price: 795,
    currency: "BWP",
    summary: "Core nanny/helper vetting for everyday household placements.",
    features: [
      "Traceable nanny/helper",
      "Thorough vetting",
      "In-depth interview",
      "Personalized matching",
      "1 month grace period for incompatibility",
      "Pre-employment orientation",
      "Employment contract",
      "No criminal record check, fingerprint clearance billed where applicable",
    ],
  },
  {
    id: "vip",
    name: "VIP",
    price: 995,
    currency: "BWP",
    summary: "Priority vetting for families with sensitive household information.",
    features: [
      "Everything included in Standard",
      "NDA signed by nanny/helper",
      "Priority handling for faster placements",
      "Ideal for high-profile families or sensitive family information",
      "Employment contract",
    ],
  },
];

export function categorySupportsVettingPackages(category: string) {
  return VETTING_PACKAGE_CATEGORIES.has(category);
}

export function getVettingPackagesForCategory(category: string) {
  return categorySupportsVettingPackages(category) ? VETTING_PACKAGES : [];
}

export function getVettingPackage(id: string | undefined) {
  return VETTING_PACKAGES.find((plan) => plan.id === id);
}
