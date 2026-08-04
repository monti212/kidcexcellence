import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VERIFICATION_FEE } from "@/lib/verification-requirements";
import { VETTING_PACKAGES } from "@/lib/vetting-packages";

export const metadata: Metadata = {
  title: "Pricing | Kidcellence",
  description: "Kidcellence pricing for families and provider verification.",
};

const familyFeatures = [
  "Search schools, nannies, tutors, clinics, and other child related service providers",
  "Compare fees, reviews, availability, and verification signals",
  "Contact providers and keep conversations in one place",
];

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
    href: "https://wa.me/26775378699?text=Hi%20Kidcellence%2C%20I%20would%20like%20to%20choose%20the%20Standard%20Vet%20With%20Us%20Package%20for%20P795.",
  },
  {
    name: "VIP Package",
    price: "P995",
    href: "https://wa.me/26775378699?text=Hi%20Kidcellence%2C%20I%20would%20like%20to%20choose%20the%20VIP%20Vet%20With%20Us%20Package%20for%20P995.",
  },
];

function providerBillingHref(packageId?: string) {
  const billingParams = new URLSearchParams({ tab: "documents" });
  const authParams = new URLSearchParams({ role: "provider" });

  if (packageId) {
    billingParams.set("package", packageId);
    billingParams.set("category", "nannies");
    authParams.set("category", "nannies");
  }

  authParams.set("next", `/profile/provider?${billingParams.toString()}`);
  return `/auth?${authParams.toString()}`;
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
            Clear costs for finding and verifying care.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--brand-muted)]">
            Kidcellence includes monthly subscription options for parents,
            individual care providers, and broader service providers, plus managed
            vetting packages for families who want extra support.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section>
          <p className="brand-label">Monthly subscriptions</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {monthlySubscriptions.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-lg border border-[var(--brand-line)] bg-white p-5"
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

        <section className="mt-10">
          <p className="brand-label">Other pricing options</p>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            <div className="flex min-w-[17rem] flex-1 flex-col rounded-lg border border-[var(--brand-line)] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Search className="h-5 w-5 text-[var(--brand-leaf)]" />
                  <h2 className="mt-4 text-xl font-black text-[var(--brand-ink)]">
                    Families
                  </h2>
                </div>
                <div className="shrink-0 text-right">
                  <div className="whitespace-nowrap text-2xl font-black text-[var(--brand-ink)]">
                    Free
                  </div>
                  <div className="text-xs font-bold text-[var(--brand-muted)]">
                    browse
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--brand-muted)]">
                Browse and compare provider listings before choosing who to contact.
              </p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-[var(--brand-muted)]">
                {familyFeatures.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-leaf)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/search" className="mt-auto inline-block pt-6">
                <Button className="rounded-full bg-[var(--brand-sky)] px-5 font-black text-white hover:bg-[var(--brand-coral)]">
                  Browse providers
                </Button>
              </Link>
            </div>

            <div className="flex min-w-[17rem] flex-1 flex-col rounded-lg border border-[var(--brand-line)] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <ShieldCheck className="h-5 w-5 text-[var(--brand-leaf)]" />
                  <h2 className="mt-4 text-xl font-black text-[var(--brand-ink)]">
                    Provider verification
                  </h2>
                </div>
                <div className="shrink-0 text-right">
                  <div className="whitespace-nowrap text-2xl font-black text-[var(--brand-ink)]">
                    P {VERIFICATION_FEE.amount}
                  </div>
                  <div className="text-xs font-bold text-[var(--brand-muted)]">
                    one-time
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--brand-muted)]">
                Standard provider verification supports document review before a
                listing is submitted for approval.
              </p>
              <Link href={providerBillingHref()} className="mt-auto inline-block pt-6">
                <Button variant="outline" className="rounded-full border-[var(--brand-line)] bg-white px-5 font-black text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]">
                  Choose verification
                </Button>
              </Link>
            </div>

            {VETTING_PACKAGES.map((plan) => (
              <div key={plan.id} className="flex min-w-[17rem] flex-1 flex-col rounded-lg border border-[var(--brand-line)] bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-sky)]">
                      Managed vetting package
                    </p>
                    <h2 className="mt-3 text-xl font-black text-[var(--brand-ink)]">
                      {plan.name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                      {plan.summary}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="whitespace-nowrap text-2xl font-black text-[var(--brand-ink)]">
                      P {plan.price}
                    </div>
                    <div className="text-xs font-bold text-[var(--brand-muted)]">
                      {plan.currency}
                    </div>
                  </div>
                </div>
                <ul className="mt-6 space-y-3 text-sm leading-6 text-[var(--brand-muted)]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-leaf)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={providerBillingHref(plan.id)} className="mt-auto inline-block pt-6">
                  <Button className="rounded-full bg-[var(--brand-sky)] px-5 font-black text-white hover:bg-[var(--brand-coral)]">
                    Choose {plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-[var(--brand-line)] bg-white p-5">
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
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {vetWithUsWhatsAppPackages.map((pkg) => (
              <a
                key={pkg.name}
                href={pkg.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-4 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-3 transition-colors hover:border-[var(--brand-sky)] hover:bg-white"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[rgba(84,178,191,0.22)] bg-[var(--brand-cream)] text-[var(--brand-gold)]">
                    <Star className="h-4 w-4 fill-[var(--brand-gold)]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[var(--brand-ink)]">
                      {pkg.name}
                    </span>
                    <span className="block text-xs font-bold text-[var(--brand-muted)]">
                      Contact +267 75 378 699
                    </span>
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-[var(--brand-sky)]">
                  {pkg.price}
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
