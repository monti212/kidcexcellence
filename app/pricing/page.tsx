import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  MessageCircle,
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
    price: "P60",
    interval: "monthly",
    note: "For families searching, comparing, and contacting trusted child related service providers.",
    verification: "No verification fee",
    href: "/auth?role=parent",
  },
  {
    name: "Nannies / Helpers / Babysitters",
    price: "P60",
    interval: "monthly",
    note: "For individual care providers listing their services and managing enquiries.",
    verification: "Optional verification fee: P20",
    href: "/auth?role=provider&category=nannies",
  },
  {
    name: "Other Service Providers",
    price: "P150",
    interval: "monthly",
    note: "For tutors, specialists, transport, parties, agencies, schools, and other providers.",
    verification: "Optional verification fee: P50",
    href: "/auth?role=provider",
  },
];

const vetWithUsWhatsAppPackages = [
  {
    name: "Standard Package",
    price: "P795",
    summary: "Core nanny/helper vetting for everyday household placements.",
    features: ["Traceable nanny/helper", "Thorough vetting", "Personalized matching"],
    href: "https://wa.me/26775378699?text=Hi%20Kidcellence%2C%20I%20would%20like%20to%20choose%20the%20Standard%20Vet%20With%20Us%20Package%20for%20P795.",
  },
  {
    name: "VIP Package",
    price: "P995",
    summary: "Priority vetting for families with sensitive household information.",
    features: ["Everything in Standard", "NDA support", "Priority handling"],
    href: "https://wa.me/26775378699?text=Hi%20Kidcellence%2C%20I%20would%20like%20to%20choose%20the%20VIP%20Vet%20With%20Us%20Package%20for%20P995.",
  },
];

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
            Clear costs for finding and verifying care.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--brand-muted)]">
            Kidcellence includes monthly subscription options for parents,
            individual care providers, and broader service providers, plus managed
            vetting packages for families who want extra support.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-label">Monthly subscriptions</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--brand-ink)]">
                Choose the plan that matches your role.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[var(--brand-muted)]">
              Simple monthly access, with verification shown separately where it applies.
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
                <p className="mt-5 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3 py-2 text-sm font-black text-[var(--brand-ink)]">
                  {plan.verification}
                </p>
                <Link href={plan.href} className="mt-auto inline-block pt-6">
                  <Button className="rounded-full bg-[var(--brand-sky)] px-5 font-black text-white hover:bg-[var(--brand-coral)]">
                    Choose subscription
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
              These larger support packages connect families to Kidcellence on WhatsApp.
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {vetWithUsWhatsAppPackages.map((pkg) => (
              <a
                key={pkg.name}
                href={pkg.href}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[15rem] flex-col rounded-lg border border-[var(--brand-line)] bg-white p-5 transition-colors hover:border-[var(--brand-sky)] hover:bg-[var(--brand-ivory)]"
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
                  <span className="shrink-0 text-right">
                    <span className="block whitespace-nowrap text-2xl font-black text-[var(--brand-ink)]">
                      {pkg.price}
                    </span>
                    <span className="block text-xs font-bold text-[var(--brand-muted)]">
                      BWP
                    </span>
                  </span>
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
                <span className="mt-auto inline-flex w-fit items-center gap-2 pt-6 text-sm font-black text-[var(--brand-sky)]">
                  Message on WhatsApp
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
