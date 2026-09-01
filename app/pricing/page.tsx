import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing | Kidcellence",
  description: "Kidcellence pricing for families and provider verification.",
};

const monthlySubscriptions = [
  {
    name: "Parents / Guardians",
    price: "P0",
    interval: "first month",
    note: "For families searching, comparing, and contacting trusted child related service providers.",
    renewal: "Then P60 monthly",
    verification: "Everything included for the first month",
    href: "/auth?role=parent",
  },
  {
    name: "Nannies / Helpers / Babysitters",
    price: "P0",
    interval: "first month",
    note: "For individual care providers listing their services and managing enquiries.",
    renewal: "Then P60 monthly",
    verification: "Verification checkout waived during the free month",
    href: "/auth?role=provider&category=nannies",
  },
  {
    name: "Other Service Providers",
    price: "P0",
    interval: "first month",
    note: "For tutors, specialists, transport, parties, agencies, schools, and other providers.",
    renewal: "Then P150 monthly",
    verification: "Verification checkout waived during the free month",
    href: "/auth?role=provider",
  },
];

const vetWithUsPaymentPackages = [
  {
    id: "standard",
    name: "Standard Package",
    price: 795,
    summary: "Core nanny/helper vetting for everyday household placements.",
    features: ["Traceable nanny/helper", "Thorough vetting", "Personalized matching"],
  },
  {
    id: "vip",
    name: "VIP Package",
    price: 995,
    summary: "Priority vetting for families with sensitive household information.",
    features: ["Everything in Standard", "NDA support", "Priority handling"],
  },
];

function getVetWithUsPaymentHref(packageId: string) {
  return `/api/verifications/payment?packageId=${encodeURIComponent(packageId)}`;
}

export default function PricingPage() {
  return (
    <div className="brand-page min-h-screen">
      <header className="border-b border-[var(--brand-line)] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--brand-sky)] text-[var(--brand-gold)]">
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="brand-label mt-6">Pricing</p>
          <h1 className="mt-2 text-4xl font-black text-[var(--brand-ink)] sm:text-5xl">
            Full access is free for your first month.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--brand-muted)]">
            Parents and providers can use every Kidcellence feature for one month
            before any subscription payment is needed. Provider verification
            checkout is also waived while the free month is active.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-label">Free first month</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--brand-ink)]">
                Choose the account that matches your role.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[var(--brand-muted)]">
              Full access starts immediately. Monthly pricing begins after the free month.
            </p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {monthlySubscriptions.map((plan) => (
              <div
                key={plan.name}
                className="flex min-h-[18rem] flex-col rounded-lg border border-[var(--brand-line)] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {plan.href.includes("provider") ? (
                      <UserRound className="h-5 w-5 text-[var(--brand-leaf)]" />
                    ) : (
                      <UsersRound className="h-5 w-5 text-[var(--brand-leaf)]" />
                    )}
                    <h2 className="mt-4 text-xl font-black text-[var(--brand-ink)]">
                      {plan.name}
                    </h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="whitespace-nowrap text-2xl font-black text-[var(--brand-ink)]">
                      {plan.price}
                    </div>
                    <div className="text-xs font-bold text-[var(--brand-muted)]">
                      {plan.interval}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--brand-muted)]">
                  {plan.note}
                </p>
                <p className="mt-3 text-sm font-black text-[var(--brand-leaf)]">
                  {plan.renewal}
                </p>
                <p className="mt-5 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3 py-2 text-sm font-black text-[var(--brand-ink)]">
                  {plan.verification}
                </p>
                <Link href={plan.href} className="mt-auto inline-block pt-6">
                  <Button className="rounded-full bg-[var(--brand-sky)] px-5 font-black text-white hover:bg-[var(--brand-coral)]">
                    Start free month
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-[var(--brand-line)] pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-label">Vet With Us Packages</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--brand-ink)]">
                Choose a managed vetting option.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[var(--brand-muted)]">
              View the package details, then continue to the payment gateway.
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {vetWithUsPaymentPackages.map((pkg) => {
              const paymentHref = getVetWithUsPaymentHref(pkg.id);

              return (
                <div
                  key={pkg.name}
                  className="flex min-h-[15rem] flex-col rounded-lg border border-[var(--brand-line)] bg-white p-5"
                >
                  <span className="flex items-start justify-between gap-4">
                    <span>
                      <span className="grid h-10 w-10 place-items-center rounded-lg border border-[rgba(84,178,191,0.22)] bg-[var(--brand-cream)] text-[var(--brand-gold)]">
                        <Star className="h-4 w-4 fill-[var(--brand-gold)]" aria-hidden="true" />
                      </span>
                      <span className="mt-4 block text-xl font-black text-[var(--brand-ink)]">
                        {pkg.name}
                      </span>
                    </span>
                    <a
                      href={paymentHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--brand-sky)] px-4 text-sm font-black text-white transition-colors hover:bg-[var(--brand-coral)]"
                    >
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      Pay P{pkg.price}
                    </a>
                  </span>
                  <span className="mt-3 block text-sm leading-6 text-[var(--brand-muted)]">
                    {pkg.summary}
                  </span>
                  <span className="mt-5 flex flex-wrap gap-2">
                    {pkg.features.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-full border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3 py-1 text-xs font-bold text-[var(--brand-ink)]"
                      >
                        {feature}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
