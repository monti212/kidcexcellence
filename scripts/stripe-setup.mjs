#!/usr/bin/env node
/**
 * Creates the Kidcellence product catalogue in Stripe, idempotently.
 *
 * Why this exists: without configured Price ids, the checkout routes fall back
 * to inline `price_data` with `product_data`, which makes Stripe create a NEW
 * Product on every single checkout. On a live account that fills the catalogue
 * with duplicates and makes Dashboard revenue reporting useless. Running this
 * once gives every plan and fee a stable Product and Price.
 *
 * Safe to re-run: Products use deterministic ids and Prices use lookup keys, so
 * a second run reports "exists" instead of creating duplicates.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_test_... node scripts/stripe-setup.mjs
 *   STRIPE_SECRET_KEY=rk_live_... node scripts/stripe-setup.mjs
 *
 * Prefer a restricted key (rk_) with write access to Products and Prices only.
 * Stripe prices are in the smallest currency unit; BWP is not zero-decimal, so
 * every amount below is multiplied by 100.
 */
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error(
    "STRIPE_SECRET_KEY is not set.\n" +
      "Run: STRIPE_SECRET_KEY=rk_live_... node scripts/stripe-setup.mjs"
  );
  process.exit(1);
}

const stripe = new Stripe(secretKey, { maxNetworkRetries: 2 });
const live = secretKey.includes("_live_");
const CURRENCY = "bwp";

/**
 * Mirrors lib/billing-plans.ts and lib/verification-requirements.ts. Keep the
 * amounts here in sync with those files — they are the source of truth for what
 * the app charges; this script only mirrors them into Stripe.
 */
const CATALOGUE = [
  {
    envVar: "STRIPE_PRICE_PARENT",
    productId: "kidcellence_plan_parent",
    name: "Kidcellence — Parents / Guardians",
    description: "Monthly access for families searching and contacting providers.",
    amount: 60,
    recurring: true,
  },
  {
    envVar: "STRIPE_PRICE_CARE_WORKER",
    productId: "kidcellence_plan_care_worker",
    name: "Kidcellence — Nannies / Helpers / Babysitters",
    description: "Monthly listing and enquiries for individual care providers.",
    amount: 60,
    recurring: true,
  },
  {
    envVar: "STRIPE_PRICE_PROVIDER",
    productId: "kidcellence_plan_provider",
    name: "Kidcellence — Other Service Providers",
    description: "Monthly listing and enquiries for schools, tutors, clinics, and agencies.",
    amount: 150,
    recurring: true,
  },
  {
    envVar: "STRIPE_PRICE_VERIFICATION_CARE_WORKER",
    productId: "kidcellence_verification_care_worker",
    name: "Kidcellence — Care worker verification",
    description: "One-time verification review for nannies, helpers, and babysitters.",
    amount: 20,
    recurring: false,
  },
  {
    envVar: "STRIPE_PRICE_VERIFICATION_ORGANISATION",
    productId: "kidcellence_verification_organisation",
    name: "Kidcellence — Provider verification",
    description: "One-time verification review for schools, tutors, clinics, and agencies.",
    amount: 50,
    recurring: false,
  },
  {
    envVar: "STRIPE_PRICE_VETTING_STANDARD",
    productId: "kidcellence_vetting_standard",
    name: "Kidcellence — Standard vetting package",
    description: "Managed vetting for everyday household placements.",
    amount: 795,
    recurring: false,
  },
  {
    envVar: "STRIPE_PRICE_VETTING_VIP",
    productId: "kidcellence_vetting_vip",
    name: "Kidcellence — VIP vetting package",
    description: "Priority vetting for families with sensitive household information.",
    amount: 995,
    recurring: false,
  },
];

async function ensureProduct(entry) {
  try {
    const existing = await stripe.products.retrieve(entry.productId);
    return { product: existing, created: false };
  } catch (error) {
    if (error?.code !== "resource_missing") throw error;
  }

  const product = await stripe.products.create({
    // A deterministic id is what makes re-running this safe.
    id: entry.productId,
    name: entry.name,
    description: entry.description,
  });
  return { product, created: true };
}

async function ensurePrice(entry) {
  const lookupKey = `${entry.productId}_${CURRENCY}`;
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (found.data.length > 0) return { price: found.data[0], created: false };

  const price = await stripe.prices.create({
    product: entry.productId,
    currency: CURRENCY,
    unit_amount: Math.round(entry.amount * 100),
    lookup_key: lookupKey,
    ...(entry.recurring ? { recurring: { interval: "month" } } : {}),
  });
  return { price, created: true };
}

async function main() {
  console.log(`Stripe catalogue setup — ${live ? "LIVE" : "TEST"} mode\n`);

  const envLines = [];
  for (const entry of CATALOGUE) {
    const { created: productCreated } = await ensureProduct(entry);
    const { price, created: priceCreated } = await ensurePrice(entry);

    const suffix = entry.recurring ? "/month" : " one-time";
    console.log(
      `${priceCreated || productCreated ? "created" : "exists "}  ` +
        `${entry.name}  P${entry.amount}${suffix}\n` +
        `          ${price.id}`
    );
    envLines.push(`${entry.envVar}=${price.id}`);
  }

  console.log("\nAdd these to your environment:\n");
  console.log(envLines.join("\n"));

  if (live) {
    console.log(
      "\nThese are LIVE price ids. Store them wherever you keep configuration;" +
        "\nthey are not secrets, but the key you ran this with is."
    );
  }
}

main().catch((error) => {
  // Never let a key reach the logs.
  console.error(`Setup failed: ${error?.message ?? error}`);
  process.exit(1);
});
