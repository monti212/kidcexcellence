import type Stripe from "stripe";
import { getStripeCustomerId, setStripeCustomerId } from "@/lib/platform-store";
import type { PublicPlatformUser } from "@/lib/platform-store";
import { stripeClient, toStripeAmount } from "@/lib/stripe";
import {
  getBillingPlan,
  stripePriceIdForPlan,
  type BillingPlan,
} from "@/lib/billing-plans";

// Shared Checkout wiring for the billing routes. Nothing here writes payment
// state: Checkout only ever creates a session and hands back a URL. Every
// change to what a user has actually paid arrives through the verified webhook
// in app/api/stripe/webhook/route.ts, because a browser redirect can be
// abandoned, replayed, or forged.

/**
 * Returns the account's Stripe customer, creating it on first use.
 *
 * The id is persisted so repeat checkouts reuse one customer; without this the
 * Billing Portal and the admin revenue view would see a different customer for
 * every payment the same person makes.
 */
export async function ensureStripeCustomer(user: PublicPlatformUser) {
  const existing = await getStripeCustomerId(user.id);
  if (existing) return existing;

  const stripe = stripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    phone: user.phone || undefined,
    // userId lets the webhook resolve an account even when an event carries no
    // metadata of its own.
    metadata: { userId: user.id, role: user.role },
  });

  await setStripeCustomerId(user.id, customer.id);
  return customer.id;
}

/** Stripe wants lowercase ISO currency codes; the catalogue stores "BWP". */
function stripeCurrency(currency: string) {
  return currency.toLowerCase();
}

/**
 * A recurring line item for a plan.
 *
 * When a Stripe Price id is configured for the plan it is used directly, which
 * is what you want in production so Stripe owns the price history. Otherwise an
 * inline recurring price is built from the catalogue, so a fresh Stripe account
 * works without pre-creating products.
 */
export function subscriptionLineItem(plan: BillingPlan): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = stripePriceIdForPlan(plan.id);
  if (priceId) return { price: priceId, quantity: 1 };

  return {
    price_data: {
      currency: stripeCurrency(plan.currency),
      product_data: { name: `Kidcellence — ${plan.name}` },
      unit_amount: toStripeAmount(plan.price),
      recurring: { interval: plan.interval },
    },
    quantity: 1,
  };
}

/**
 * Configured Stripe Price ids for the one-off fees, created by
 * scripts/stripe-setup.mjs. Keyed by the same identifiers the checkout routes
 * already work in: a vetting package id, or the provider's fee tier.
 */
const ONE_OFF_PRICE_ENV: Record<string, string> = {
  "verification:careWorker": "STRIPE_PRICE_VERIFICATION_CARE_WORKER",
  "verification:organisation": "STRIPE_PRICE_VERIFICATION_ORGANISATION",
  "vetting:standard": "STRIPE_PRICE_VETTING_STANDARD",
  "vetting:vip": "STRIPE_PRICE_VETTING_VIP",
};

export function oneOffPriceId(key: string) {
  const envVar = ONE_OFF_PRICE_ENV[key];
  return envVar ? process.env[envVar]?.trim() || null : null;
}

/**
 * A one-off line item.
 *
 * Prefers a configured Price id. The inline `price_data` fallback keeps a fresh
 * account working, but it makes Stripe create a new Product on every checkout,
 * so run scripts/stripe-setup.mjs before taking live payments.
 */
export function oneOffLineItem(
  name: string,
  amount: number,
  currency: string,
  priceKey?: string
): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = priceKey ? oneOffPriceId(priceKey) : null;
  if (priceId) return { price: priceId, quantity: 1 };

  return {
    price_data: {
      currency: stripeCurrency(currency),
      product_data: { name },
      unit_amount: toStripeAmount(amount),
    },
    quantity: 1,
  };
}

export interface CheckoutRequest {
  user: PublicPlatformUser;
  baseUrl: string;
  returnPath: string;
  kind: "subscription" | "verification" | "vetting";
  lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  planId?: string;
  packageId?: string;
  description: string;
}

export async function createCheckoutSession(request: CheckoutRequest) {
  const stripe = stripeClient();
  const customerId = await ensureStripeCustomer(request.user);
  const separator = request.returnPath.includes("?") ? "&" : "?";

  // Metadata is duplicated onto the subscription/payment intent because the
  // webhook receives those objects on their own for renewals and failures,
  // long after the originating Checkout Session is out of scope.
  const metadata: Record<string, string> = {
    userId: request.user.id,
    kind: request.kind,
    description: request.description,
  };
  if (request.planId) metadata.planId = request.planId;
  if (request.packageId) metadata.packageId = request.packageId;

  return stripe.checkout.sessions.create({
    mode: request.kind === "subscription" ? "subscription" : "payment",
    customer: customerId,
    client_reference_id: request.user.id,
    line_items: [request.lineItem],
    // Tags the session so these flows can be compared in the Dashboard. The
    // random-looking suffix is required by Stripe's convention and is fixed on
    // purpose: a value that changed per deploy would fragment the reporting.
    integration_identifier: `kidcellence_${request.kind}_hjkwqmzt`,
    metadata,
    // payment_method_types is deliberately not set. Stripe then offers every
    // method enabled in the Dashboard; hardcoding ["card"] would lock out
    // methods that improve conversion.
    ...(request.kind === "subscription"
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata } }),
    success_url: `${request.baseUrl}${request.returnPath}${separator}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${request.baseUrl}${request.returnPath}${separator}checkout=cancelled`,
  });
}

export function planForCheckout(planId: string | undefined) {
  const plan = getBillingPlan(planId);
  if (!plan) throw new Error("Choose a valid subscription plan.");
  return plan;
}
