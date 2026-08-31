import { NextResponse } from "next/server";
import {
  effectiveVerificationPayment,
  fullAccessEntitlementForUser,
  getSessionFromRequest,
  providerAnalyticsSummary,
  readStore,
  saveProviderProfile,
} from "@/lib/platform-store";
import { providerIsApproved } from "@/lib/platform-service";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

interface PublishRequirementIssue {
  section: string;
  field: string;
  tab: "basic" | "pricing";
  hint: string;
}

function profileWithEffectivePayment(
  profile: Awaited<ReturnType<typeof readStore>>["providerProfiles"][string],
  user: Parameters<typeof effectiveVerificationPayment>[1]
) {
  const payment = effectiveVerificationPayment(profile, user);
  return {
    ...profile,
    verificationPaymentStatus: payment.status,
    verificationFeeAmount: payment.amount,
    verificationFeeCurrency: payment.currency,
    verificationFeePaidAt: payment.paidAt,
    verificationPaymentReference: payment.reference,
    verificationPackageId: payment.packageId,
    verificationPackageName: payment.packageName,
  };
}

function hasStartingPrice(profile: {
  price: string;
  feeRows: Array<{ termly: string; annually: string }>;
}) {
  return (
    Number(profile.price) > 0 ||
    profile.feeRows.some((row) => Number(row.termly) > 0 || Number(row.annually) > 0)
  );
}

function missingPublishRequirements(profile: {
  displayName: string;
  location: string;
  bio: string;
  phone: string;
  services: string[];
  price: string;
  feeRows: Array<{ termly: string; annually: string }>;
}): PublishRequirementIssue[] {
  const missing: PublishRequirementIssue[] = [];

  if (!profile.displayName) {
    missing.push({
      section: "Basic Info",
      field: "Public display name",
      tab: "basic",
      hint: "Enter the name families should see on your listing.",
    });
  }
  if (!profile.location) {
    missing.push({
      section: "Basic Info",
      field: "Location / Area",
      tab: "basic",
      hint: "Add the area or city where you provide care.",
    });
  }
  if (!profile.bio) {
    missing.push({
      section: "Basic Info",
      field: "About / Description",
      tab: "basic",
      hint: "Describe your service so families understand what you offer.",
    });
  }
  if (profile.services.length === 0) {
    missing.push({
      section: "Basic Info",
      field: "Services",
      tab: "basic",
      hint: "Add at least one service. Separate multiple services with commas.",
    });
  }
  if (!profile.phone) {
    missing.push({
      section: "Basic Info > Contact Information",
      field: "Phone Number",
      tab: "basic",
      hint: "Add the phone number families can use to contact you.",
    });
  }
  if (!hasStartingPrice(profile)) {
    missing.push({
      section: "Pricing",
      field: "Starting price",
      tab: "pricing",
      hint: "For schools/nurseries, fill a Per Term or Per Year fee. For other providers, fill the Price field.",
    });
  }

  return missing;
}

function publishCompletion(profile: {
  displayName: string;
  location: string;
  bio: string;
  phone: string;
  services: string[];
  price: string;
  feeRows: Array<{ termly: string; annually: string }>;
} | null) {
  if (!profile) return 0;
  const checks = [
    Boolean(profile.displayName),
    Boolean(profile.location),
    Boolean(profile.bio),
    profile.services.length > 0,
    Boolean(profile.phone),
    hasStartingPrice(profile),
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = auth.session.userId;
  const store = await readStore();
  const profile = userId ? store.providerProfiles[userId] ?? null : null;
  const displayName = profile?.displayName || auth.user.name;

  return NextResponse.json({
    profile: profile ? profileWithEffectivePayment(profile, auth.user) : null,
    subscription: fullAccessEntitlementForUser(auth.user),
    verified: providerIsApproved(
      store.verifications.approvedProviders,
      displayName,
      auth.session.userId
    ),
    analytics: {
      ...providerAnalyticsSummary(store, auth.session.userId),
      profileCompletion: publishCompletion(profile),
    },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `profile-provider:${auth.session.userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many profile updates. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  const userId = String(body?.userId ?? auth.session.userId);

  if (userId !== auth.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!body?.profile) {
    return NextResponse.json(
      { error: "profile is required" },
      { status: 400 }
    );
  }

  const currentStore = await readStore();
  const currentProfile = currentStore.providerProfiles[userId];
  const verificationStatus = currentProfile?.verificationStatus ?? "not_submitted";
  const requestedPublish = Boolean(body.profile.published);
  const normalized = {
    displayName: String(body.profile.displayName ?? auth.user.name).trim(),
    category: String(body.profile.category ?? "schools"),
    location: String(body.profile.location ?? auth.user.location ?? "").trim(),
    bio: String(body.profile.bio ?? "").trim(),
    phone: String(body.profile.phone ?? auth.user.phone ?? "").trim(),
    whatsapp: String(body.profile.whatsapp ?? body.profile.phone ?? "").trim(),
    services: Array.isArray(body.profile.services)
      ? body.profile.services
          .map(String)
          .map((item: string) => item.trim())
          .filter(Boolean)
      : [],
    experience: String(body.profile.experience ?? "").trim(),
    availability: String(body.profile.availability ?? "").trim(),
    price: String(body.profile.price ?? "").trim(),
    priceUnit: ["monthly", "per day", "per hour", "termly"].includes(body.profile.priceUnit)
      ? (body.profile.priceUnit as "monthly" | "per day" | "per hour" | "termly")
      : "termly",
    age: String(body.profile.age ?? "").trim(),
    stayArrangement: body.profile.stayArrangement === "stay-in" ? "stay-in" as const : "stay-out" as const,
    hasChildren: body.profile.hasChildren === "yes" ? "yes" as const : body.profile.hasChildren === "no" ? "no" as const : undefined,
    workStartDate: String(body.profile.workStartDate ?? "").trim(),
    willingToRelocate: Boolean(body.profile.willingToRelocate),
    childrenCount: String(body.profile.childrenCount ?? "").trim(),
    workExperienceSummary: String(body.profile.workExperienceSummary ?? "").trim(),
    yearsExperience: String(body.profile.yearsExperience ?? "").trim(),
    references: String(body.profile.references ?? "").trim(),
    nextOfKinName: String(body.profile.nextOfKinName ?? "").trim(),
    nextOfKinPhone: String(body.profile.nextOfKinPhone ?? "").trim(),
    nextOfKinRelationship: String(body.profile.nextOfKinRelationship ?? "").trim(),
    ownerFullName: String(body.profile.ownerFullName ?? "").trim(),
    tradingHours: String(body.profile.tradingHours ?? "").trim(),
    numberPlate: String(body.profile.numberPlate ?? "").trim(),
    prdp: String(body.profile.prdp ?? "").trim(),
    mission: String(body.profile.mission ?? "").trim(),
    vision: String(body.profile.vision ?? "").trim(),
    values: String(body.profile.values ?? "").trim(),
    medicalAids: String(body.profile.medicalAids ?? "").trim(),
    liveIn: Boolean(body.profile.liveIn),
    published: requestedPublish,
    verificationStatus,
    verificationPaymentStatus: currentProfile?.verificationPaymentStatus ?? "unpaid",
    verificationFeeAmount: currentProfile?.verificationFeeAmount,
    verificationFeeCurrency: currentProfile?.verificationFeeCurrency,
    verificationFeePaidAt: currentProfile?.verificationFeePaidAt,
    verificationPaymentReference: currentProfile?.verificationPaymentReference,
    verificationPackageId: currentProfile?.verificationPackageId,
    verificationPackageName: currentProfile?.verificationPackageName,
    feeRows: Array.isArray(body.profile.feeRows)
      ? body.profile.feeRows.map((row: unknown) => {
          const item = row as Record<string, unknown>;
          return {
            grade: String(item.grade ?? "").trim(),
            termly: String(item.termly ?? "").trim(),
            annually: String(item.annually ?? "").trim(),
          };
        })
      : [],
  };

  const publishRequirements = requestedPublish
    ? missingPublishRequirements(normalized)
    : [];

  if (publishRequirements.length > 0) {
    return NextResponse.json(
      {
        error: "Complete the highlighted fields before publishing.",
        publishRequirements,
      },
      { status: 400 }
    );
  }

  const profile = await saveProviderProfile(userId, normalized);
  const store = await readStore();

  return NextResponse.json({
    profile: profileWithEffectivePayment(profile, auth.user),
    subscription: fullAccessEntitlementForUser(auth.user),
    verified: providerIsApproved(
      store.verifications.approvedProviders,
      profile.displayName || auth.user.name,
      auth.session.userId
    ),
    publicId: profile.published ? `account-${userId}` : null,
  });
}
