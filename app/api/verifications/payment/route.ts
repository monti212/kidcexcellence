import { NextResponse } from "next/server";
import {
  getSessionFromRequest,
  readStore,
  recordVerificationPayment,
} from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation, requestBaseUrl } from "@/lib/request-guard";
import { VERIFICATION_FEES, getVerificationFee } from "@/lib/verification-requirements";
import {
  VETTING_PACKAGES,
  categorySupportsVettingPackages,
  getVettingPackage,
} from "@/lib/vetting-packages";
import { stripeEnabled, unpaidVerificationFallbackAllowed } from "@/lib/stripe";
import { createCheckoutSession, oneOffLineItem } from "@/lib/billing-service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ fees: VERIFICATION_FEES, packages: VETTING_PACKAGES });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth || auth.user.role !== "provider") {
    return NextResponse.json({ error: "Provider authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `provider-verification-payment:${auth.session.userId}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const packageId = typeof body?.packageId === "string" ? body.packageId : undefined;

    if (stripeEnabled()) {
      const store = await readStore();
      const profile = store.providerProfiles[auth.session.userId];
      if (!profile) {
        throw new Error(
          "Complete and save your provider profile before paying for verification."
        );
      }
      if (profile.verificationStatus === "approved") {
        throw new Error("This provider profile is already verified.");
      }

      // A vetting package is an optional upgrade; without one the provider
      // simply pays their category's verification fee.
      const selectedPackage = categorySupportsVettingPackages(profile.category)
        ? getVettingPackage(packageId)
        : null;
      const fee = getVerificationFee(profile.category);

      const amount = selectedPackage?.price ?? fee.amount;
      const currency = selectedPackage?.currency ?? fee.currency;
      const label = selectedPackage
        ? `Kidcellence ${selectedPackage.name} vetting package`
        : "Kidcellence provider verification fee";
      // Resolves to a configured Stripe Price when scripts/stripe-setup.mjs has
      // been run; otherwise createCheckoutSession falls back to an inline price.
      const priceKey = selectedPackage
        ? `vetting:${selectedPackage.id}`
        : `verification:${
            amount === VERIFICATION_FEES.careWorker.amount ? "careWorker" : "organisation"
          }`;

      const session = await createCheckoutSession({
        user: auth.user,
        baseUrl: requestBaseUrl(request),
        returnPath: "/profile/provider?tab=verification",
        kind: selectedPackage ? "vetting" : "verification",
        lineItem: oneOffLineItem(label, amount, currency, priceKey),
        packageId: selectedPackage?.id,
        description: label,
      });

      // No payment state changes here. The provider is marked paid only when
      // Stripe confirms it through app/api/stripe/webhook/route.ts.
      return NextResponse.json({ checkoutUrl: session.url });
    }

    if (!unpaidVerificationFallbackAllowed()) {
      return NextResponse.json(
        {
          error:
            "Billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to accept verification payments.",
        },
        { status: 503 }
      );
    }

    // Development and the integration suite only: records the fee as paid with
    // no money moving, so the verification flow stays testable offline. Blocked
    // in production by unpaidVerificationFallbackAllowed().
    const payment = await recordVerificationPayment(auth.session.userId, packageId);
    return NextResponse.json({ payment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record verification payment." },
      { status: 400 }
    );
  }
}
