"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ProviderCard from "@/components/ProviderCard";
import {
  ADDITIONAL_PLATFORM_CATEGORIES,
  CATEGORIES,
  CORE_SERVICE_CATEGORY_COUNT,
  CORE_SERVICE_CATEGORIES,
  type Provider,
} from "@/lib/mock-data";
import {
  ArrowRight,
  Baby,
  BookOpen,
  Brain,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Drama,
  Handshake,
  HeartHandshake,
  Hospital,
  HouseHeart,
  MessageCircle,
  PartyPopper,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  Sprout,
  Stethoscope,
  Target,
  UserRound,
} from "lucide-react";

const needCategoryStyles = [
  {
    card: "border-[rgba(84,178,191,0.3)] bg-white",
    count: "text-[var(--brand-sky)]",
  },
  {
    card: "border-[rgba(255,204,47,0.46)] bg-white",
    count: "text-[var(--brand-ink)]",
  },
  {
    card: "border-[rgba(84,178,191,0.24)] bg-white",
    count: "text-[var(--brand-sky)]",
  },
  {
    card: "border-[rgba(255,204,47,0.36)] bg-white",
    count: "text-[var(--brand-ink)]",
  },
];

const categoryIconMap: Record<string, typeof Baby> = {
  babysitters: Baby,
  nannies: UserRound,
  helpers: HouseHeart,
  schools: School,
  nurseries: Sprout,
  tutors: BookOpen,
  "pediatric-clinics": Hospital,
  "pediatric-therapy": Stethoscope,
  "child-psychologists": Brain,
  "after-school": Target,
  "kiddies-transport": Car,
  "kiddies-parties": PartyPopper,
  agencies: Handshake,
  "kiddies-entertainment": Drama,
};

const vetWithUsPackages = [
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

function CategoryIcon({ categoryId }: { categoryId: string }) {
  const Icon = categoryIconMap[categoryId] ?? HeartHandshake;

  return (
    <span className="grid h-12 w-12 place-items-center rounded-xl border border-[rgba(84,178,191,0.22)] bg-[var(--brand-cream)] text-[var(--brand-sky)]">
      <Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

function CompactCategoryIcon({ categoryId }: { categoryId: string }) {
  const Icon = categoryIconMap[categoryId] ?? HeartHandshake;

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[rgba(84,178,191,0.2)] bg-[var(--brand-cream)] text-[var(--brand-sky)]">
      <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
    </span>
  );
}

function CategorySubcategoryList({
  subcategories,
}: {
  subcategories: NonNullable<(typeof CATEGORIES)[number]["subcategories"]>;
}) {
  return (
    <div className="pointer-events-none absolute left-4 right-4 top-[7.25rem] z-20 max-h-52 space-y-2 overflow-y-auto rounded-lg border border-[var(--brand-line)] bg-white p-3 opacity-0 shadow-lg transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      {subcategories.map((subcategory) => (
        <div key={subcategory.id}>
          <div className="flex items-start gap-1.5 text-xs font-bold leading-5 text-[var(--brand-muted)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-sky)]" />
            <span>{subcategory.name}</span>
          </div>
          {subcategory.children?.length ? (
            <div className="ml-3 mt-1 flex flex-wrap gap-1">
              {subcategory.children.map((child) => (
                <span
                  key={child.id}
                  className="rounded-full bg-[var(--brand-ivory)] px-2 py-0.5 text-[0.66rem] font-bold leading-5 text-[var(--brand-muted)]"
                >
                  {child.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [featuredProviders, setFeaturedProviders] = useState<Provider[]>([]);
  const [marketplaceProviders, setMarketplaceProviders] = useState<Provider[]>([]);

  useEffect(() => {
    const loadFeaturedProviders = async () => {
      const response = await fetch("/api/providers", {
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload.providers)) {
        setMarketplaceProviders(payload.providers);
        const featured = payload.providers.filter((provider: Provider) => provider.featured);
        setFeaturedProviders((featured.length ? featured : payload.providers.filter((p: Provider) => p.verified)).slice(0, 6));
      }
    };
    void loadFeaturedProviders();
  }, []);

  const verifiedProviderCount = marketplaceProviders.filter(
    (provider) => provider.verified
  ).length;
  const categoryCounts = new Map(
    CATEGORIES.map((category) => [
      category.id,
      marketplaceProviders.filter((provider) => provider.category === category.id).length,
    ])
  );

  return (
    <div className="brand-page">
      <section className="w-full">
        <div className="flex flex-col items-center text-center">
          <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-[url('/landing-hero.jpeg')] bg-cover bg-center">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,24,20,0.82)_0%,rgba(16,24,20,0.58)_45%,rgba(16,24,20,0.22)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent_0%,rgba(16,24,20,0.66)_100%)]" />
            <style>{`
              @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .animate-fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
              .delay-1 { animation-delay: 0.2s; }
              .delay-2 { animation-delay: 0.4s; }
              .delay-3 { animation-delay: 0.6s; }
              .delay-4 { animation-delay: 0.8s; }
            `}</style>
            <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16 text-center">
              <h1 className="max-w-3xl text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight text-white drop-shadow-lg animate-fade-in-up">
                Child-centered discovery for modern Botswana families.
              </h1>
              <p className="mt-4 max-w-2xl text-lg italic sm:text-xl text-white/90 drop-shadow-md animate-fade-in-up delay-1">
                Kidcellence is an all-in-one hub that helps you search trusted
                schools, nannies, tutors, clinics, and care services, compare
                options, and connect with the right support for your child.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 justify-center animate-fade-in-up delay-2">
                <Link href="/search">
                  <Button className="rounded-full bg-white px-6 py-3 font-black text-[var(--brand-ink)] hover:bg-[var(--brand-gold)]">
                    Search services
                  </Button>
                </Link>
                <Link href="/auth?role=provider">
                  <Button variant="outline" className="rounded-full border-white/70 bg-white/15 font-black text-white backdrop-blur hover:bg-white/25">
                    For providers
                  </Button>
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2 justify-center animate-fade-in-up delay-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] shadow-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-coral)]" />
                  Kidcellence curated network
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-[var(--brand-sky)]" />
                  Verification-led matching
                </div>
              </div>
            </div>
          </div>
          

          

          <div className="mx-auto mb-12 mt-8 grid w-full max-w-7xl grid-cols-1 gap-3 px-4 sm:mb-14 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              [String(marketplaceProviders.length), "listed providers"],
              [String(verifiedProviderCount), "verified profiles"],
              [String(CORE_SERVICE_CATEGORY_COUNT), "service categories"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-[1.5rem] border border-[var(--brand-line)] bg-white/80 p-4 shadow-sm">
                <div className="text-2xl font-black text-[var(--brand-ink)]">{value}</div>
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {featuredProviders.length > 0 && (
            <div className="mx-auto mt-10 w-full max-w-7xl px-4 pb-12 text-left sm:px-6 lg:px-8">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-black text-[var(--brand-ink)]">Featured Providers</h3>
                <div className="text-sm text-[var(--brand-muted)]">Sponsored listings — advertise here</div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredProviders.map((p) => (
                  <div key={p.id} className="relative">
                    <div className="absolute right-3 top-3 z-10 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-black text-white">Sponsored</div>
                    <ProviderCard provider={p} />
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-[var(--brand-line)] p-3 text-center text-sm text-[var(--brand-muted)]">
                Want to feature your listing? <Link href="/auth?role=provider"><span className="font-bold text-[var(--brand-ink)]">Contact us</span></Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-[var(--brand-line)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            [CheckCircle2, "Document-aware verification", "Submitted provider files stay private and are available only to verification administrators."],
            [ClipboardCheck, "Side-by-side decisions", "Parents can compare location, fees, availability, reviews, services, and verification status."],
            [Sparkles, "Provider-ready onboarding", "Schools, clinics, tutors, and individual caregivers get category-specific signup paths."],
          ].map(([Icon, title, body]) => {
            const TypedIcon = Icon as typeof CheckCircle2;
            return (
              <div key={title as string} className="flex gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] bg-[var(--brand-cream)] text-[var(--brand-sky)]">
                  <TypedIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-black text-[var(--brand-ink)]">{title as string}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{body as string}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="brand-label">Discovery</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--brand-ink)]">Browse care by need</h2>
          </div>
          <Link href="/search" className="inline-flex items-center gap-2 text-sm font-black text-[var(--brand-sky)]">
            View all providers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {CORE_SERVICE_CATEGORIES.map((category, index) => {
            const accent = needCategoryStyles[index % needCategoryStyles.length];
            const displayCount =
              category.id === "schools"
                ? (categoryCounts.get("schools") ?? 0) + (categoryCounts.get("nurseries") ?? 0)
                : categoryCounts.get(category.id) ?? 0;

            return (
              <Link
                key={category.id}
                href={`/search?category=${category.id}`}
                className={`brand-card group relative min-h-48 p-4 transition-transform hover:-translate-y-1 hover:border-[var(--brand-sky)] focus-visible:border-[var(--brand-sky)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-sky)]/30 ${accent.card}`}
              >
                <CategoryIcon categoryId={category.id} />
                <div className="mt-4 text-sm font-black text-[var(--brand-ink)]">{category.name}</div>
                {category.subcategories?.length ? (
                  <CategorySubcategoryList subcategories={category.subcategories} />
                ) : null}
                <div className={`mt-1 text-xs font-black ${accent.count}`}>
                  {displayCount} providers
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-8 border-t border-[var(--brand-line)] pt-6">
          <p className="brand-label">Additional options</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ADDITIONAL_PLATFORM_CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.id}`}
                className="rounded-lg border border-[var(--brand-line)] bg-white px-4 py-3 transition-colors hover:bg-[var(--brand-ivory)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CompactCategoryIcon categoryId={category.id} />
                    <span className="text-sm font-black text-[var(--brand-ink)]">{category.name}</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--brand-muted)]">
                    {categoryCounts.get(category.id) ?? 0} providers
                  </span>
                </div>
              </Link>
            ))}
            <div className="rounded-lg border border-[var(--brand-line)] bg-white px-4 py-3">
              <div className="flex items-start gap-3">
                <CompactCategoryIcon categoryId="nannies" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-[var(--brand-ink)]">Vet With Us Packages</div>
                  <div className="mt-3 grid gap-2">
                    {vetWithUsPackages.map((pkg) => (
                      <a
                        key={pkg.name}
                        href={pkg.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3 py-2 text-sm transition-colors hover:border-[var(--brand-sky)] hover:bg-white"
                      >
                        <span className="flex items-center gap-2 font-black text-[var(--brand-ink)]">
                          <Star className="h-3.5 w-3.5 fill-[var(--brand-gold)] text-[var(--brand-gold)]" />
                          {pkg.name}
                        </span>
                        <span className="inline-flex items-center gap-2 font-black text-[var(--brand-sky)]">
                          {pkg.price}
                          <MessageCircle className="h-3.5 w-3.5" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="brand-label">Verified results</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--brand-ink)]">Featured providers</h2>
          </div>
          <Link href="/compare">
            <Button variant="outline" className="rounded-full border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
              Compare providers
            </Button>
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProviders.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
          {featuredProviders.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-dashed border-[var(--brand-line)] bg-white px-6 py-12 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-[var(--brand-leaf)]" />
              <h3 className="mt-3 font-black text-[var(--brand-ink)]">
                Verified listings are being prepared
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--brand-muted)]">
                Published provider profiles appear here after document review and approval.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-lg bg-[var(--brand-sky)] p-6 text-white md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-gold)]">For providers</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black">List your childcare service and manage trust from one dashboard.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Add your profile, fees, documents, service areas, availability, and parent messages.
              Kidcellence keeps discovery and verification in one place.
            </p>
          </div>
          <div className="flex items-center">
            <Link href="/auth?role=provider">
              <Button className="rounded-lg bg-[var(--brand-gold)] px-6 font-black text-[var(--brand-ink)] hover:bg-white">
                Start provider onboarding
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
