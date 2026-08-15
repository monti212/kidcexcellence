import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/platform-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";
import { VERIFICATION_FEE } from "@/lib/verification-requirements";
import { VETTING_PACKAGES } from "@/lib/vetting-packages";

export const runtime = "nodejs";

function configuredStripePaymentLink(packageId?: string) {
  if (packageId === "standard") {
    return process.env.STRIPE_STANDARD_VETTING_PAYMENT_LINK;
  }
  if (packageId === "vip") {
    return process.env.STRIPE_VIP_VETTING_PAYMENT_LINK;
  }
  return process.env.STRIPE_VERIFICATION_PAYMENT_LINK ?? process.env.STRIPE_PAYMENT_LINK;
}

function stripeCheckoutUrl(link: string, reference: string, email: string) {
  try {
    const url = new URL(link);
    url.searchParams.set("client_reference_id", reference);
    url.searchParams.set("prefilled_email", email);
    return url.toString();
  } catch {
    return link;
  }
}

export async function GET() {
  return NextResponse.json({ fee: VERIFICATION_FEE, packages: VETTING_PACKAGES });
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
    const stripeLink = configuredStripePaymentLink(packageId);

    if (!stripeLink) {
      return NextResponse.json(
        { error: "Payment checkout is not configured yet. Please contact Kidcellence before paying." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      checkoutUrl: stripeCheckoutUrl(
        stripeLink,
        `verification:${auth.session.userId}:${packageId ?? "standard"}`,
        auth.user.email
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open the payment page." },
      { status: 400 }
    );
  }
}
