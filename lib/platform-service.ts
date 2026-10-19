import { PROVIDERS, type Provider } from "@/lib/mock-data";
import {
  ADDITIONAL_SERVICES,
  CORE_SERVICES,
  SERVICES,
  getService,
  sanitizeServiceDetails,
} from "@/lib/services";
import type {
  PlatformUploadRecord,
  PlatformUser,
  ProviderProfileRecord,
} from "@/lib/platform-store";

export type ProviderSort = "rating" | "price_asc" | "price_desc" | "reviews";

export interface ProviderFilters {
  q?: string;
  categories?: string[];
  location?: string;
  maxPrice?: number;
  verifiedOnly?: boolean;
  sortBy?: ProviderSort;
}

export interface PendingVerification {
  id: string;
  userId?: string;
  name: string;
  category: string;
  location: string;
  submittedDate: string;
  documents: string[];
  image: string;
  status: "pending";
}

export interface ApprovedVerification {
  id: string;
  userId?: string;
  name: string;
  category: string;
  verified: true;
  date: string;
}

export function getCategories() {
  return SERVICES;
}

export function getCoreServiceCategories() {
  return CORE_SERVICES;
}

export function getAdditionalPlatformCategories() {
  return ADDITIONAL_SERVICES;
}

export function getCategoryById(id: string) {
  return getService(id);
}

/** Resolves a category id, or the label stored on verification records. */
function getCategoryByIdOrLabel(value: string) {
  return getService(value) ?? SERVICES.find((service) => service.label === value);
}

export function getCategoryIcon(categoryIdOrLabel: string) {
  return getCategoryByIdOrLabel(categoryIdOrLabel)?.icon ?? "✨";
}

export function getCategoryLabel(categoryId: string) {
  return getCategoryById(categoryId)?.label ?? categoryId;
}

export function getProviderById(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function getProviderByName(name: string) {
  return PROVIDERS.find((provider) => provider.name === name);
}

export function getProvidersByIds(ids: string[]) {
  const idSet = new Set(ids);
  return PROVIDERS.filter((provider) => idSet.has(provider.id)).sort(
    (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
  );
}

export function filterProviders(filters: ProviderFilters = {}) {
  return filterProviderList(PROVIDERS, filters);
}

export function filterProviderList(
  providers: Provider[],
  filters: ProviderFilters = {}
) {
  const {
    q,
    categories = [],
    location,
    maxPrice = Number.POSITIVE_INFINITY,
    verifiedOnly = false,
    sortBy = "rating",
  } = filters;
  let result = [...providers];

  const normalizedQuery = q?.trim().toLowerCase();
  if (normalizedQuery) {
    result = result.filter(
      (provider) =>
        provider.name.toLowerCase().includes(normalizedQuery) ||
        provider.location.toLowerCase().includes(normalizedQuery) ||
        provider.category.toLowerCase().includes(normalizedQuery) ||
        getCategoryLabel(provider.category).toLowerCase().includes(normalizedQuery) ||
        provider.services.some((service) => service.toLowerCase().includes(normalizedQuery))
    );
  }

  if (categories.length > 0) {
    result = result.filter((provider) => categories.includes(provider.category));
  }

  if (location && location !== "All Locations") {
    result = result.filter((provider) =>
      provider.location.toLowerCase().includes(location.toLowerCase())
    );
  }

  if (verifiedOnly) {
    result = result.filter((provider) => provider.verified);
  }

  result = result.filter((provider) => provider.price <= maxPrice);

  return sortProviders(result, sortBy);
}

export function buildAccountProvider(
  user: PlatformUser,
  profile: ProviderProfileRecord,
  uploads: PlatformUploadRecord[] = [],
  verified = false
): Provider {
  const fees = profile.feeRows
    .filter((row) => row.grade.trim())
    .map((row) => ({
      grade: row.grade.trim(),
      termly: Number(row.termly) || 0,
      annually: Number(row.annually) || 0,
    }));
  const prices = fees.map((fee) => fee.termly).filter((price) => price > 0);
  const gallery = uploads
    .filter((upload) => upload.userId === user.id && upload.type === "gallery")
    .map((upload) => `/api/uploads/${upload.id}`);
  const profileImage = uploads.find(
    (upload) => upload.userId === user.id && upload.type === "profile-image"
  );
  const coverImage = uploads.find(
    (upload) => upload.userId === user.id && upload.type === "cover-image"
  );
  const companyProfile = uploads.find(
    (upload) =>
      upload.userId === user.id &&
      upload.type === "document" &&
      upload.documentKey === "company-profile"
  );
  const profilePrice = Number(profile.price) || 0;
  // Stay-in, own kids, and relocation are household-care questions; every
  // profile stores defaults for them, so only show them where they were asked.
  const isCareWorker = getService(profile.category)?.profileTemplate === "care-worker";

  return {
    id: `account-${user.id}`,
    name: profile.displayName || user.name,
    category: profile.category,
    location: profile.location || user.location || "Botswana",
    price: profilePrice || (prices.length ? Math.min(...prices) : 0),
    priceUnit: profile.priceUnit,
    rating: 0,
    reviewCount: 0,
    verified,
    bio: profile.workExperienceSummary || profile.bio,
    image: profileImage
      ? `/api/uploads/${profileImage.id}`
      : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          profile.displayName || user.name
        )}`,
    coverImage: coverImage ? `/api/uploads/${coverImage.id}` : undefined,
    age: Number(profile.age) || undefined,
    stayArrangement: isCareWorker ? profile.stayArrangement : undefined,
    hasChildren: isCareWorker ? profile.hasChildren : undefined,
    willingToRelocate: isCareWorker ? profile.willingToRelocate : undefined,
    childrenCount: isCareWorker ? Number(profile.childrenCount) || undefined : undefined,
    yearsExperience: Number(profile.yearsExperience) || undefined,
    references: profile.references,
    nextOfKin:
      profile.nextOfKinName || profile.nextOfKinPhone || profile.nextOfKinRelationship
        ? [profile.nextOfKinName, profile.nextOfKinRelationship, profile.nextOfKinPhone]
            .filter(Boolean)
            .join(" · ")
        : undefined,
    ownerFullName: profile.ownerFullName,
    tradingHours: profile.tradingHours,
    numberPlate: profile.numberPlate,
    prdp: profile.prdp,
    mission: profile.mission,
    vision: profile.vision,
    values: profile.values,
    medicalAids: profile.medicalAids,
    companyProfileUrl: companyProfile ? `/api/uploads/${companyProfile.id}` : undefined,
    serviceDetails: sanitizeServiceDetails(profile.category, profile.serviceDetails),
    services: profile.services,
    experience: profile.yearsExperience
      ? `${profile.yearsExperience} years${profile.experience ? ` · ${profile.experience}` : ""}`
      : profile.experience,
    availability: profile.workStartDate
      ? `Available from ${profile.workStartDate}`
      : profile.availability,
    gallery,
    fees,
    phone: profile.phone || user.phone || "",
    email: user.email,
    whatsapp: profile.whatsapp || profile.phone || user.phone || "",
  };
}

function userCanListAsProvider(
  user: PlatformUser,
  providerProfiles: Record<string, ProviderProfileRecord>
) {
  return (
    user.role === "provider" ||
    user.roles?.includes("provider") ||
    Boolean(providerProfiles[user.id]) ||
    Boolean(user.category)
  );
}

export function accountProvidersFromStore(store: {
  users: PlatformUser[];
  providerProfiles: Record<string, ProviderProfileRecord>;
  uploads: PlatformUploadRecord[];
  verifications: {
    approvedProviders: ApprovedVerification[];
  };
}) {
  const listedProviderIds = new Set<string>();
  const accountProviders = store.users.flatMap((user) => {
    const profile = store.providerProfiles[user.id];
    if (!userCanListAsProvider(user, store.providerProfiles) || !profile) return [];
    listedProviderIds.add(user.id);
    return [
      buildAccountProvider(
        user,
        profile,
        store.uploads,
        providerIsApproved(
          store.verifications.approvedProviders,
          profile.displayName || user.name,
          user.id
        )
      ),
    ];
  });

  const profileOnlyProviders = Object.entries(store.providerProfiles).flatMap(
    ([userId, profile]) => {
      if (listedProviderIds.has(userId)) return [];
      return [
        buildAccountProvider(
          {
            id: userId,
            role: "provider",
            roles: ["provider"],
            name: profile.displayName || "Provider",
            email: "",
            phone: profile.phone,
            location: profile.location,
            category: profile.category,
            passwordHash: "",
            createdAt: profile.savedAt,
          },
          profile,
          store.uploads,
          providerIsApproved(
            store.verifications.approvedProviders,
            profile.displayName,
            userId
          )
        ),
      ];
    }
  );

  return [...accountProviders, ...profileOnlyProviders];
}

export function allProvidersFromStore(store: {
  users: PlatformUser[];
  providerProfiles: Record<string, ProviderProfileRecord>;
  uploads: PlatformUploadRecord[];
  verifications: {
    approvedProviders: ApprovedVerification[];
  };
}) {
  const includeDemoProviders = process.env.ENABLE_DEMO_PROVIDERS === "true";
  return [
    ...accountProvidersFromStore(store),
    ...(includeDemoProviders ? PROVIDERS : []),
  ];
}

export function providerIsApproved(
  approvedProviders: ApprovedVerification[],
  displayName: string,
  userId?: string
) {
  const normalizedName = displayName.trim().toLowerCase();
  return approvedProviders.some(
    (provider) =>
      (userId && provider.userId === userId) ||
      provider.name.trim().toLowerCase() === normalizedName
  );
}

export function sortProviders(providers: Provider[], sortBy: ProviderSort = "rating") {
  return [...providers].sort((a, b) => {
    if (sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "price_desc") return b.price - a.price;
    if (sortBy === "reviews") return b.reviewCount - a.reviewCount;
    return b.rating - a.rating;
  });
}
