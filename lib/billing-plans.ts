import type { UserRole } from "@/lib/platform-store";

/**
 * Recurring subscription catalogue.
 *
 * These are the plans advertised on /pricing. Prices live here rather than in
 * Stripe so the marketing page, the billing dashboard, and the Checkout Session
 * all read one number. The Stripe Price id for each plan comes from the
 * environment, because it differs between test and live mode.
 */
export type BillingPlanId = "parent" | "care-worker" | "provider";

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  audience: string;
  price: number;
  currency: "BWP";
  interval: "month";
  summary: string;
  features: string[];
}

/**
 * Individual care workers pay the lower provider rate. This mirrors the
 * "Nannies / Helpers / Babysitters" row on /pricing. It is deliberately a
 * separate constant from the vetting-package category set in
 * lib/vetting-packages.ts: the two happen to hold the same categories today,
 * but one governs subscription price and the other governs vetting eligibility.
 */
const CARE_WORKER_PLAN_CATEGORIES = new Set(["nannies", "helpers", "babysitters"]);

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "parent",
    name: "Parents / Guardians",
    audience: "Families searching for care",
    price: 60,
    currency: "BWP",
    interval: "month",
    summary:
      "For families searching, comparing, and contacting trusted child related service providers.",
    features: [
      "Search and compare every published provider",
      "Message providers directly",
      "Save and revisit shortlists",
      "No verification fee",
    ],
  },
  {
    id: "care-worker",
    name: "Nannies / Helpers / Babysitters",
    audience: "Individual care providers",
    price: 60,
    currency: "BWP",
    interval: "month",
    summary:
      "For individual care providers listing their services and managing enquiries.",
    features: [
      "Published provider profile",
      "Receive and reply to parent enquiries",
      "Upload documents for verification",
      "Optional paid verification badge",
    ],
  },
  {
    id: "provider",
    name: "Other Service Providers",
    audience: "Schools, tutors, clinics, agencies",
    price: 150,
    currency: "BWP",
    interval: "month",
    summary:
      "For tutors, specialists, transport, parties, agencies, schools, and other providers.",
    features: [
      "Published organisation profile with gallery",
      "Receive and reply to parent enquiries",
      "Fee tables and company profile documents",
      "Optional paid verification badge",
    ],
  },
];

export function getBillingPlan(id: string | undefined): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.id === id);
}

/**
 * The plan a given account is expected to be on. Admins are staff accounts and
 * are never billed.
 */
export function planForAccount(role: UserRole, category?: string): BillingPlan | null {
  if (role === "admin") return null;
  if (role === "parent") return getBillingPlan("parent") ?? null;
  return (
    getBillingPlan(
      category && CARE_WORKER_PLAN_CATEGORIES.has(category) ? "care-worker" : "provider"
    ) ?? null
  );
}

const PLAN_PRICE_ENV: Record<BillingPlanId, string> = {
  parent: "STRIPE_PRICE_PARENT",
  "care-worker": "STRIPE_PRICE_CARE_WORKER",
  provider: "STRIPE_PRICE_PROVIDER",
};

/**
 * The configured Stripe Price id for a plan, if one is set. When absent the
 * checkout route builds an inline recurring price from the catalogue above, so
 * a fresh Stripe account works without pre-creating products.
 */
export function stripePriceIdForPlan(planId: BillingPlanId) {
  return process.env[PLAN_PRICE_ENV[planId]]?.trim() || null;
}

export function planIdForStripePrice(priceId: string | null | undefined): BillingPlanId | null {
  if (!priceId) return null;
  const match = BILLING_PLANS.find((plan) => stripePriceIdForPlan(plan.id) === priceId);
  return match?.id ?? null;
}
