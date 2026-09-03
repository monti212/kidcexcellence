import { NextResponse } from "next/server";
import { getBillingOverview, getSessionFromRequest } from "@/lib/platform-store";
import { BILLING_PLANS } from "@/lib/billing-plans";
import { stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

/** Platform-wide revenue overview. Mirrors the admin guard used by the verification queue. */
export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (auth?.session.role !== "admin") {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  const overview = await getBillingOverview();
  return NextResponse.json({
    ...overview,
    billingEnabled: stripeEnabled(),
    plans: BILLING_PLANS,
    admin: { name: auth.user.name, email: auth.user.email },
  });
}
