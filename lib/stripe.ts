import Stripe from "stripe";

// Server-side Stripe access.
//
// Like lib/supabase.ts, this module holds a secret key and must never be
// imported from a client component. Route handlers are the only callers.
//
// The API version is intentionally not pinned here: the installed SDK pins its
// own (see node_modules/stripe/OPENAPI_VERSION), and hard-coding a string that
// disagrees with the SDK's types breaks the build on every upgrade.

let cachedClient: { secretKey: string; client: Stripe } | null = null;

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

/**
 * Whether live Stripe billing is wired up.
 *
 * When this is false the app stays usable — checkout routes report that billing
 * is unavailable, and the verification fee falls back to the local
 * "mark as paid" path used by the integration suite. See
 * `unpaidVerificationFallbackAllowed()` for why that fallback cannot fire in
 * production.
 */
export function stripeEnabled() {
  return Boolean(stripeSecretKey());
}

export function stripeClient() {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY to enable billing."
    );
  }

  if (cachedClient?.secretKey === secretKey) return cachedClient.client;

  const client = new Stripe(secretKey, {
    appInfo: { name: "kidcellence-billing" },
    maxNetworkRetries: 2,
  });
  cachedClient = { secretKey, client };
  return client;
}

export function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/**
 * The pre-Stripe behaviour recorded a verification fee as paid the moment the
 * provider clicked pay. That is fine for local development and for the
 * integration suite, which runs without Stripe credentials, but in production
 * it would hand out paid status for free. Production requires real Stripe
 * credentials instead.
 */
export function unpaidVerificationFallbackAllowed() {
  return !stripeEnabled() && process.env.NODE_ENV !== "production";
}

/**
 * Stripe expects the smallest currency unit. Every amount in this codebase is
 * stated in major units (BWP 250, BWP 795), and none of the currencies used are
 * zero-decimal, so the conversion is a flat x100.
 */
export function toStripeAmount(majorUnits: number) {
  return Math.round(majorUnits * 100);
}

export function fromStripeAmount(minorUnits: number | null | undefined) {
  return typeof minorUnits === "number" ? minorUnits / 100 : 0;
}
