"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type { BillingPlan } from "@/lib/billing-plans";

interface AdminPayment {
  id: string;
  userName: string;
  userEmail: string;
  kind: "subscription" | "verification" | "vetting";
  description: string;
  amount: number;
  currency: string;
  status: "paid" | "failed" | "refunded";
  createdAt: string;
}

interface AdminSubscriber {
  stripeSubscriptionId: string;
  userName: string;
  userEmail: string;
  planId: string;
  status: string;
  amount: number;
  currency: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

interface AdminBillingState {
  billingEnabled: boolean;
  currency: string;
  monthlyRecurringRevenue: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  planBreakdown: Record<string, { count: number; amount: number }>;
  revenueByKind: Record<string, number>;
  totalCollected: number;
  failedPayments: number;
  recentPayments: AdminPayment[];
  subscribers: AdminSubscriber[];
  plans: BillingPlan[];
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

const KIND_LABELS: Record<string, string> = {
  subscription: "Subscriptions",
  verification: "Verification fees",
  vetting: "Vetting packages",
};

export default function AdminBillingPage() {
  const [state, setState] = useState<AdminBillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetch("/api/admin/billing", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          setUnauthorized(true);
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((payload) => {
        if (payload) setState(payload);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-[var(--brand-muted)]">
        Loading billing overview…
      </div>
    );
  }

  if (unauthorized || !state) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-[var(--brand-sky)]" />
        <h1 className="text-2xl font-black text-[var(--brand-ink)]">Admin access required</h1>
        <p className="mt-2 text-sm text-[var(--brand-muted)]">
          Sign in with an allowlisted admin account to view platform revenue.
        </p>
        <Link href="/auth?role=admin" className="mt-6 inline-block">
          <Button className="rounded-full bg-[var(--brand-sky)] px-6 font-extrabold text-white">
            Admin sign in
          </Button>
        </Link>
      </div>
    );
  }

  const planName = (planId: string) =>
    state.plans.find((plan) => plan.id === planId)?.name ?? planId;

  const stats = [
    {
      label: "Monthly recurring revenue",
      value: formatMoney(state.monthlyRecurringRevenue, state.currency),
      icon: <TrendingUp className="h-5 w-5 text-emerald-600" />,
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "Active subscriptions",
      value: state.activeSubscriptions,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "Payment overdue",
      value: state.pastDueSubscriptions,
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
      bg: "bg-orange-50",
      border: "border-orange-100",
    },
    {
      label: "Cancelled",
      value: state.canceledSubscriptions,
      icon: <XCircle className="h-5 w-5 text-gray-500" />,
      bg: "bg-gray-50",
      border: "border-gray-100",
    },
    {
      label: "Total collected",
      value: formatMoney(state.totalCollected, state.currency),
      icon: <BadgeCheck className="h-5 w-5 text-violet-500" />,
      bg: "bg-violet-50",
      border: "border-violet-100",
    },
    {
      label: "Failed payments",
      value: state.failedPayments,
      icon: <CreditCard className="h-5 w-5 text-red-500" />,
      bg: "bg-red-50",
      border: "border-red-100",
    },
  ];

  return (
    <div className="min-h-screen brand-page">
      <div
        className="flex items-center gap-3 px-6 py-4 text-white shadow-md"
        style={{ background: "linear-gradient(135deg, var(--brand-ink), var(--brand-leaf))" }}
      >
        <CreditCard className="h-6 w-6" />
        <div>
          <h1 className="text-lg font-black">Kidcellence Billing</h1>
          <p className="text-xs text-white/70">Revenue and subscription overview</p>
        </div>
        <div className="ml-auto">
          <Link href="/admin">
            <Button
              size="sm"
              className="rounded-full bg-white/20 font-black text-white hover:bg-white/30"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Verification queue
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!state.billingEnabled && (
          <div className="mb-6 rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Stripe is not configured on this environment. These totals reflect only what is
            already recorded in the store.
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-lg border bg-white p-5 shadow-sm ${stat.border}`}
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                {stat.icon}
              </div>
              <div className="text-2xl font-extrabold text-[var(--brand-ink)]">{stat.value}</div>
              <div className="mt-0.5 text-sm text-[var(--brand-muted)]">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Plan mix */}
          <div className="rounded-lg border border-[var(--brand-line)] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-[var(--brand-ink)]">Active plan mix</h2>
            {state.activeSubscriptions === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--brand-muted)]">
                No active subscriptions yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {state.plans.map((plan) => {
                  const entry = state.planBreakdown[plan.id];
                  const count = entry?.count ?? 0;
                  const share = Math.round((count / state.activeSubscriptions) * 100);
                  return (
                    <li key={plan.id}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="font-bold text-[var(--brand-ink)]">{plan.name}</span>
                        <span className="text-[var(--brand-muted)]">
                          {count} · {formatMoney(entry?.amount ?? 0, state.currency)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--brand-ivory)]">
                        <div
                          className="h-full rounded-full bg-[var(--brand-sky)]"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Revenue by source */}
          <div className="rounded-lg border border-[var(--brand-line)] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-[var(--brand-ink)]">Revenue by source</h2>
            <ul className="space-y-3">
              {["subscription", "verification", "vetting"].map((kind) => (
                <li
                  key={kind}
                  className="flex items-center justify-between border-b border-[var(--brand-line)] pb-3 text-sm last:border-0 last:pb-0"
                >
                  <span className="text-[var(--brand-muted)]">{KIND_LABELS[kind]}</span>
                  <span className="font-bold text-[var(--brand-ink)]">
                    {formatMoney(state.revenueByKind[kind] ?? 0, state.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Subscribers */}
        <div className="mb-8 rounded-lg border border-[var(--brand-line)] bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-black text-[var(--brand-ink)]">Subscribers</h2>
          {state.subscribers.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--brand-muted)]">
              No subscriptions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--brand-line)] text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    <th className="pb-2 font-bold">Account</th>
                    <th className="pb-2 font-bold">Plan</th>
                    <th className="pb-2 font-bold">Amount</th>
                    <th className="pb-2 font-bold">Renews</th>
                    <th className="pb-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.subscribers.map((subscriber) => (
                    <tr
                      key={subscriber.stripeSubscriptionId}
                      className="border-b border-[var(--brand-line)] last:border-0"
                    >
                      <td className="py-3">
                        <div className="font-bold text-[var(--brand-ink)]">
                          {subscriber.userName}
                        </div>
                        <div className="text-xs text-[var(--brand-muted)]">
                          {subscriber.userEmail}
                        </div>
                      </td>
                      <td className="py-3 text-[var(--brand-muted)]">
                        {planName(subscriber.planId)}
                      </td>
                      <td className="py-3 font-bold text-[var(--brand-ink)]">
                        {formatMoney(subscriber.amount, subscriber.currency)}
                      </td>
                      <td className="py-3 text-[var(--brand-muted)]">
                        {formatDate(subscriber.currentPeriodEnd)}
                        {subscriber.cancelAtPeriodEnd && (
                          <span className="ml-1 text-xs font-bold text-orange-600">
                            (ending)
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          className={`rounded-full border-0 text-xs ${
                            subscriber.status === "active" || subscriber.status === "trialing"
                              ? "bg-emerald-50 text-emerald-700"
                              : subscriber.status === "past_due"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {subscriber.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className="rounded-lg border border-[var(--brand-line)] bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-black text-[var(--brand-ink)]">Recent payments</h2>
          {state.recentPayments.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--brand-muted)]">
              No payments recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--brand-line)] text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    <th className="pb-2 font-bold">Date</th>
                    <th className="pb-2 font-bold">Account</th>
                    <th className="pb-2 font-bold">Description</th>
                    <th className="pb-2 font-bold">Amount</th>
                    <th className="pb-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.recentPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-[var(--brand-line)] last:border-0"
                    >
                      <td className="py-3 text-[var(--brand-muted)]">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="font-bold text-[var(--brand-ink)]">
                          {payment.userName}
                        </div>
                        <div className="text-xs text-[var(--brand-muted)]">
                          {payment.userEmail}
                        </div>
                      </td>
                      <td className="py-3 text-[var(--brand-muted)]">{payment.description}</td>
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
