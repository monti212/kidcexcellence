import {
  CATEGORIES,
  CONVERSATIONS,
  PROVIDERS,
  type Conversation,
  type Provider,
} from "@/lib/mock-data";
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

export const PENDING_VERIFICATIONS: PendingVerification[] = [
  {
    id: "p1",
    name: "Happy Feet Nursery",
    category: "Nursery",
    location: "Gaborone West",
    submittedDate: "2025-04-01",
    documents: ["CV", "Proof of Residence", "Prospectus"],
    image: "https://picsum.photos/400/300?random=50",
    status: "pending",
  },
  {
    id: "p2",
    name: "Ntombi Khumalo",
    category: "Nanny",
    location: "Tlokweng",
    submittedDate: "2025-04-02",
    documents: ["ID Copy", "CV", "2 References"],
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Ntombi",
    status: "pending",
  },
  {
    id: "p3",
    name: "Dr. Tsholo Mokoena",
    category: "Pediatric Clinic",
    location: "Broadhurst",
    submittedDate: "2025-04-03",
    documents: ["Medical License", "CV", "Proof of Practice"],
    image: "https://api.dicebear.com/7.x/personas/svg?seed=Tsholo",
    status: "pending",
  },
];

export const APPROVED_VERIFICATIONS: ApprovedVerification[] = [
  { id: "a1", name: "Sunshine Early Learning Centre", category: "School", verified: true, date: "2025-03-15" },
  { id: "a2", name: "Little Stars Nursery", category: "Nursery", verified: true, date: "2025-03-20" },
  { id: "a3", name: "Kefilwe Modise", category: "Nanny", verified: true, date: "2025-03-25" },
  { id: "a4", name: "Dr. Mpho Ramodupi", category: "Pediatric Clinic", verified: true, date: "2025-03-28" },
  { id: "a5", name: "Naledi Kgomotso", category: "Tutor", verified: true, date: "2025-04-01" },
];

export function getCategories() {
  return CATEGORIES;
}

export function getCategoryById(id: string) {
  return CATEGORIES.find((category) => category.id === id);
}

export function getCategoryIcon(categoryId: string) {
  return getCategoryById(categoryId)?.icon ?? "✨";
}

export function getCategoryLabel(categoryId: string) {
  return (
    {
      schools: "School",
      nurseries: "Nursery",
      nannies: "Nanny",
      babysitters: "Babysitter",
      "pediatric-clinics": "Pediatric Clinic",
      tutors: "Tutor",
    }[categoryId] ?? categoryId
  );
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
  const profilePrice = Number(profile.price) || 0;

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
    bio: profile.bio,
    image: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      profile.displayName || user.name
    )}`,
    services: profile.services,
    experience: profile.experience,
    availability: profile.availability,
    gallery,
    fees,
    phone: profile.phone || user.phone || "",
    email: user.email,
    whatsapp: profile.whatsapp || profile.phone || user.phone || "",
  };
}

export function accountProvidersFromStore(store: {
  users: PlatformUser[];
  providerProfiles: Record<string, ProviderProfileRecord>;
  uploads: PlatformUploadRecord[];
  verifications: {
    approvedProviders: ApprovedVerification[];
  };
}) {
  return store.users.flatMap((user) => {
    const profile = store.providerProfiles[user.id];
    if (user.role !== "provider" || !profile?.published) return [];
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
}

export function allProvidersFromStore(store: {
  users: PlatformUser[];
  providerProfiles: Record<string, ProviderProfileRecord>;
  uploads: PlatformUploadRecord[];
  verifications: {
    approvedProviders: ApprovedVerification[];
  };
}) {
  return [...accountProvidersFromStore(store), ...PROVIDERS];
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

export function buildProviderConversation(provider: Provider): Conversation {
  return {
    id: `provider-${provider.id}`,
    participant: provider.name,
    participantImage: provider.image,
    lastMessage: "New enquiry started from provider profile.",
    timestamp: "now",
    unread: 0,
    messages: [
      {
        id: `welcome-${provider.id}`,
        senderId: "provider",
        text: `Hello, this is ${provider.name}. Send your question and we will respond with availability, fees, and visit options.`,
        timestamp: "now",
        isOwn: false,
      },
    ],
  };
}

export function getConversations(providerId?: string | null) {
  if (!providerId) return CONVERSATIONS;
  const provider = getProviderById(providerId);
  if (!provider) return CONVERSATIONS;
  if (CONVERSATIONS.some((conversation) => conversation.participant === provider.name)) {
    return CONVERSATIONS;
  }
  return [buildProviderConversation(provider), ...CONVERSATIONS];
}

export function getVerificationQueues() {
  return {
    pendingProviders: PENDING_VERIFICATIONS,
    approvedProviders: APPROVED_VERIFICATIONS,
    rejectedCount: 0,
  };
}
