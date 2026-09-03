import type Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  applyBillingEvent,
  findUserByStripeCustomerId,
  type BillingEventChanges,
  type BillingPaymentRecord,
  type BillingSubscriptionStatus,
} from "@/lib/platform-store";
import { planIdForStripePrice, type BillingPlanId } from "@/lib/billing-plans";
import { fromStripeAmount, stripeClient, stripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
// Stripe signs the exact bytes it sent. Any caching or transformation of this
// route's request would invalidate the signature.
export const dynamic = "force-dynamic";

// Stripe webhook — the ONLY writer of paid state.
//
// Deliberately not guarded by isSameOriginMutation(): Stripe posts here from
// its own servers, so an origin check would reject every real delivery. The
// signature check below replaces it, and is strictly stronger.

const HANDLED_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

function unixToIso(seconds: number | null | undefined) {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : undefined;
}

function idOf(value: string | { id: string } | null | undefined) {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

/** Resolves the account an event belongs to: metadata first, customer second. */
async function resolveUserId(
  metadata: Stripe.Metadata | null | undefined,
  customer: string | { id: string } | null | undefined
) {
  const fromMetadata = metadata?.userId;
  if (fromMetadata) return fromMetadata;
  const customerId = idOf(customer);
  if (!customerId) return null;
  const user = await findUserByStripeCustomerId(customerId);
  return user?.id ?? null;
}

function subscriptionChanges(
  subscription: Stripe.Subscription,
  userId: string
): BillingEventChanges["subscription"] {
  // current_period_end moved from the subscription to its items in recent API
  // versions, so it is read from the first item here.
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const planId =
    (subscription.metadata?.planId as BillingPlanId | undefined) ??
    planIdForStripePrice(price?.id) ??
    "provider";

  return {
    userId,
    planId,
    status: subscription.status as BillingSubscriptionStatus,
    stripeCustomerId: idOf(subscription.customer) ?? "",
    stripeSubscriptionId: subscription.id,
    stripePriceId: price?.id,
    amount: fromStripeAmount(price?.unit_amount),
    currency: (price?.currency ?? "bwp").toUpperCase(),
    currentPeriodEnd: unixToIso(item?.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    startedAt: unixToIso(subscription.start_date) ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canceledAt: unixToIso(subscription.canceled_at),
  };
}

async function changesForEvent(event: Stripe.Event): Promise<BillingEventChanges | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = await resolveUserId(session.metadata, session.customer);
      if (!userId) return null;

      const customerId = idOf(session.customer);
      const changes: BillingEventChanges = {};
      if (customerId) changes.stripeCustomer = { userId, stripeCustomerId: customerId };

      // Subscription checkouts are recorded from the subscription and invoice
      // events instead, which carry the authoritative period and amount.
      if (session.mode !== "payment") return changes;
      if (session.payment_status !== "paid") return changes;

      const kind = session.metadata?.kind === "vetting" ? "vetting" : "verification";
      const amount = fromStripeAmount(session.amount_total);
      const currency = (session.currency ?? "bwp").toUpperCase();
      const packageId = session.metadata?.packageId;

      changes.payment = {
        id: session.id,
        userId,
        kind,
        description: session.metadata?.description ?? "Verification fee",
        amount,
        currency,
        status: "paid",
        stripeCustomerId: customerId,
        stripeSessionId: session.id,
        stripePaymentIntentId: idOf(session.payment_intent),
        packageId,
        createdAt: new Date().toISOString(),
      };

      // This is what actually unlocks verification submission. Before Stripe,
      // the app set it the moment the provider clicked pay.
      changes.verificationPaid = {
        userId,
        amount,
        currency,
        reference: session.payment_intent ? String(idOf(session.payment_intent)) : session.id,
        packageId,
        packageName: session.metadata?.packageName,
      };

      return changes;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(subscription.metadata, subscription.customer);
      if (!userId) return null;

      const record = subscriptionChanges(subscription, userId);
      if (record && event.type === "customer.subscription.deleted") {
        record.status = "canceled";
        record.canceledAt = record.canceledAt ?? new Date().toISOString();
      }
      return { subscription: record };
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // A renewal invoice carries no metadata of its own; Stripe snapshots the
      // subscription's metadata onto parent.subscription_details instead.
      // Failing that, resolveUserId() falls back to the linked customer.
      const invoiceMetadata =
        invoice.metadata?.userId
          ? invoice.metadata
          : (invoice.parent?.subscription_details?.metadata ?? invoice.metadata);
      const userId = await resolveUserId(invoiceMetadata, invoice.customer);
      if (!userId) return null;

      const paid = event.type === "invoice.paid";
      const payment: BillingPaymentRecord = {
        id: invoice.id ?? `${event.id}-invoice`,
        userId,
        kind: "subscription",
        description: paid ? "Subscription payment" : "Failed subscription payment",
        amount: fromStripeAmount(paid ? invoice.amount_paid : invoice.amount_due),
        currency: (invoice.currency ?? "bwp").toUpperCase(),
        status: paid ? "paid" : "failed",
        stripeCustomerId: idOf(invoice.customer),
        stripeInvoiceId: invoice.id,
        createdAt: new Date().toISOString(),
      };
      return { payment };
    }

    default:
      return null;
  }
}

export async function POST(request: Request) {
  const secret = stripeWebhookSecret();
  if (!secret) {
    // Failing closed matters: without the secret every payload is unverified,
    // and this route grants paid status.
    return NextResponse.json(
      { error: "Stripe webhook secret is not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // The raw body, byte for byte — request.json() would break the signature.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 }
    );
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    const changes = await changesForEvent(event);
    if (!changes) {
      // Nothing to apply (an event for an account this platform does not know).
      // Answering 200 stops Stripe retrying something that will never resolve.
      return NextResponse.json({ received: true, handled: false });
    }

    const { applied } = await applyBillingEvent(event.id, changes);
    return NextResponse.json({ received: true, handled: true, applied });
  } catch (error) {
    // A 500 makes Stripe retry with backoff, which is what we want for a
    // transient store failure.
    console.error("Stripe webhook processing failed", event.id, event.type, error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
