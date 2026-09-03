import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation, requestBaseUrl } from "@/lib/request-guard";
import { stripeEnabled } from "@/lib/stripe";
import {
  createCheckoutSession,
  planForCheckout,
  subscriptionLineItem,
} from "@/lib/billing-service";
import { planForAccount } from "@/lib/billing-plans";

export const runtime = "nodejs";

/** Starts a subscription Checkout Session and returns its URL. */
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (auth.user.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts are not billed." },
      { status: 400 }
    );
  }

  if (!stripeEnabled()) {
    return NextResponse.json(
      { error: "Billing is not configured on this environment." },
      { status: 503 }
    );
  }

  const rateLimit = consumeRateLimit({
    key: `billing-checkout:${auth.session.userId}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    // The plan is derived from the account's own role and category, not taken
    // from the request body, so a parent cannot check out on the cheaper
    // care-worker price by posting a different planId.
    const expected = planForAccount(auth.user.role, auth.user.category);
    const plan = planForCheckout(expected?.id ?? body?.planId);

    const session = await createCheckoutSession({
      user: auth.user,
      baseUrl: requestBaseUrl(request),
      returnPath: "/billing",
      kind: "subscription",
      lineItem: subscriptionLineItem(plan),
      planId: plan.id,
      description: `${plan.name} subscription`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      { status: 400 }
    );
  }
}
