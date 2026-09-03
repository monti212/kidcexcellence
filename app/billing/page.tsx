"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import type { BillingPlan } from "@/lib/billing-plans";
import { usePlatformSession } from "@/lib/use-platform-session";

interface SubscriptionState {
  planId: string;
  status: string;
  amount: number;
  currency: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  startedAt: string;
}

interface PaymentState {
  id: string;
  kind: "subscription" | "verification" | "vetting";
  description: string;
  amount: number;
  currency: string;
  status: "paid" | "failed" | "refunded";
  createdAt: string;
}

interface BillingState {
  billingEnabled: boolean;
  role: "parent" | "provider" | "admin";
  plan: BillingPlan | null;
  subscription: SubscriptionState | null;
  payments: PaymentState[];
}

function formatMoney(amount: number, currency: string) {
  const value = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "BWP" ? `P${value}` : `${currency} ${value}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Stripe's statuses, mapped to something a customer can act on. */
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700" },
  trialing: { label: "Trial", className: "bg-blue-50 text-blue-700" },
  past_due: { label: "Payment overdue", className: "bg-orange-100 text-orange-700" },
  unpaid: { label: "Unpaid", className: "bg-red-50 text-red-700" },
  incomplete: { label: "Incomplete", className: "bg-orange-50 text-orange-700" },
  incomplete_expired: { label: "Expired", className: "bg-red-50 text-red-700" },
  paused: { label: "Paused", className: "bg-gray-100 text-gray-700" },
  canceled: { label: "Cancelled", className: "bg-gray-100 text-gray-700" },
};

function BillingDashboard() {
  const searchParams = useSearchParams();
  const { user, loading: sessionLoading } = usePlatformSession();
  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const checkoutOutcome = searchParams.get("checkout");

  useEffect(() => {
    fetch("/api/billing", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload) setState(payload);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const startCheckout = async () => {
    setError("");
    setWorking(true);
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);
    if (response?.ok && payload?.checkoutUrl) {
      window.location.href = payload.checkoutUrl;
      return;
    }
    setError(payload?.error ?? "Could not start checkout.");
    setWorking(false);
  };

  const openPortal = async () => {
    setError("");
    setWorking(true);
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);
    if (response?.ok && payload?.portalUrl) {
      window.location.href = payload.portalUrl;
      return;
    }
    setError(payload?.error ?? "Could not open the billing portal.");
    setWorking(false);
  };

  if (sessionLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[var(--brand-muted)]">
        Loading billing…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <CreditCard className="mx-auto mb-4 h-10 w-10 text-[var(--brand-sky)]" />
        <h1 className="text-2xl font-black text-[var(--brand-ink)]">Billing</h1>
        <p className="mt-2 text-sm text-[var(--brand-muted)]">
          Sign in to see your plan and payment history.
        </p>
        <Link href="/auth" className="mt-6 inline-block">
          <Button className="rounded-full bg-[var(--brand-sky)] px-6 font-extrabold text-white">
            Sign in
          </Button>
        </Link>
      </div>
    );
  }

  const subscription = state?.subscription ?? null;
  const plan = state?.plan ?? null;
  const active = subscription?.status === "active" || subscription?.status === "trialing";
  const statusStyle = subscription ? STATUS_STYLES[subscription.status] : null;

  return (
    <div className="min-h-screen brand-page">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[var(--brand-ink)]">Billing</h1>
          <p className="mt-1 text-sm text-[var(--brand-muted)]">
            Your Kidcellence plan, payment method, and receipts.
          </p>
        </div>

        {checkoutOutcome === "success" && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="text-sm">
              <p className="font-bold text-emerald-800">Payment received.</p>
              <p className="text-emerald-700">
                Stripe is confirming it now. This page updates as soon as the confirmation
                arrives — usually within a few seconds.
              </p>
            </div>
          </div>
        )}

        {checkoutOutcome === "cancelled" && (
          <div className="mb-6 rounded-lg border border-[var(--brand-line)] bg-white px-4 py-3 text-sm text-[var(--brand-muted)]">
            Checkout was cancelled. Nothing has been charged.
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm font-bold text-red-700">{error}</p>
          </div>
        )}

        {state && !state.billingEnabled && (
          <div className="mb-6 rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Billing is not configured on this environment, so checkout is unavailable.
          </div>
        )}

        {/* Current plan */}
        <div className="mb-8 rounded-lg border border-[var(--brand-line)] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-lg font-black text-[var(--brand-ink)]">
                  {plan?.name ?? "Your plan"}
                </h2>
                {statusStyle && (
                  <Badge className={`rounded-full border-0 text-xs ${statusStyle.className}`}>
                    {statusStyle.label}
                  </Badge>
                )}
              </div>
              <p className="max-w-lg text-sm text-[var(--brand-muted)]">
                {plan?.summary ?? "No plan applies to this account."}
              </p>

              {subscription ? (
                <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-[var(--brand-muted)]">Price</dt>
                    <dd className="font-bold text-[var(--brand-ink)]">
                      {formatMoney(subscription.amount, subscription.currency)} / month
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-[var(--brand-muted)]">
                      {subscription.cancelAtPeriodEnd ? "Access ends" : "Renews"}
                    </dt>
                    <dd className="font-bold text-[var(--brand-ink)]">
                      {formatDate(subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                </dl>
              ) : (
                plan && (
                  <p className="mt-4 text-2xl font-black text-[var(--brand-ink)]">
                    {formatMoney(plan.price, plan.currency)}
                    <span className="ml-1 text-sm font-medium text-[var(--brand-muted)]">
                      / month
                    </span>
                  </p>
                )
              )}
            </div>

            <div className="flex flex-col gap-2">
              {active ? (
                <Button
                  onClick={openPortal}
                  disabled={working}
                  className="rounded-full bg-[var(--brand-sky)] px-6 font-extrabold text-white"
                >
                  {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Manage billing
                </Button>
              ) : (
                plan && (
                  <Button
                    onClick={startCheckout}
                    disabled={working || !state?.billingEnabled}
                    className="rounded-full bg-[var(--brand-sky)] px-6 font-extrabold text-white"
                  >
                    {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {subscription ? "Restart subscription" : "Subscribe"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )
              )}
              <Link href="/pricing" className="text-center text-xs font-bold text-[var(--brand-muted)] hover:text-[var(--brand-ink)]">
                Compare plans
              </Link>
            </div>
          </div>

          {subscription?.cancelAtPeriodEnd && (
            <p className="mt-4 rounded-lg bg-[var(--brand-cream)] px-4 py-3 text-sm text-[var(--brand-ink)]">
              This subscription is set to cancel at the end of the current period. You keep
              access until {formatDate(subscription.currentPeriodEnd)}.
            </p>
          )}

          {plan && (
            <ul className="mt-5 grid gap-2 border-t border-[var(--brand-line)] pt-5 sm:grid-cols-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-[var(--brand-muted)]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-sky)]" />
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Payment history */}
        <div className="rounded-lg border border-[var(--brand-line)] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[var(--brand-sky)]" />
            <h2 className="text-lg font-black text-[var(--brand-ink)]">Payment history</h2>
          </div>

          {!state?.payments.length ? (
            <p className="py-8 text-center text-sm text-[var(--brand-muted)]">
              No payments yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--brand-line)] text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    <th className="pb-2 font-bold">Date</th>
                    <th className="pb-2 font-bold">Description</th>
                    <th className="pb-2 font-bold">Amount</th>
                    <th className="pb-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[var(--brand-line)] last:border-0">
                      <td className="py-3 text-[var(--brand-muted)]">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="py-3 font-medium text-[var(--brand-ink)]">
                        {payment.description}
                      </td>
                      <td className="py-3 font-bold text-[var(--brand-ink)]">
                        {formatMoney(payment.amount, payment.currency)}
                      </td>
                      <td className="py-3">
                        <Badge
                          className={`rounded-full border-0 text-xs ${
                            payment.status === "paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : payment.status === "failed"
                                ? "bg-red-50 text-red-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {payment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[var(--brand-muted)]">
          Loading billing…
        </div>
      }
    >
      <BillingDashboard />
    </Suspense>
  );
}
