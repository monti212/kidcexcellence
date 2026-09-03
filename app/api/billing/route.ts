import { NextResponse } from "next/server";
import { getSessionFromRequest, getUserBilling } from "@/lib/platform-store";
import { BILLING_PLANS, planForAccount } from "@/lib/billing-plans";
import { stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

/** The signed-in account's own plan, status, and payment history. */
export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { subscription, payments } = await getUserBilling(auth.session.userId);
  const expectedPlan = planForAccount(auth.user.role, auth.user.category);

  return NextResponse.json({
    billingEnabled: stripeEnabled(),
    role: auth.user.role,
    plan: expectedPlan,
    plans: BILLING_PLANS,
    subscription,
    payments,
  });
}
