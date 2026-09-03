import { NextResponse } from "next/server";
import { getSessionFromRequest, getStripeCustomerId } from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation, requestBaseUrl } from "@/lib/request-guard";
import { stripeClient, stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Opens the Stripe Billing Portal.
 *
 * Card updates, invoice history, and cancellation all live there rather than in
 * this app, so no card data ever touches Kidcellence.
 */
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!stripeEnabled()) {
    return NextResponse.json(
      { error: "Billing is not configured on this environment." },
      { status: 503 }
    );
  }

  const rateLimit = consumeRateLimit({
    key: `billing-portal:${auth.session.userId}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const customerId = await getStripeCustomerId(auth.session.userId);
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account yet. Start a subscription first." },
      { status: 400 }
    );
  }

  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${requestBaseUrl(request)}/billing`,
    });
    return NextResponse.json({ portalUrl: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open the billing portal." },
      { status: 400 }
    );
  }
}
