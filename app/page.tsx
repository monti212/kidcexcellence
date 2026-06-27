"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProviderCard from "@/components/ProviderCard";
import { CATEGORIES, type Provider } from "@/lib/mock-data";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";

const LOCATIONS = ["Gaborone", "Francistown", "Maun", "Kasane", "Lobatse", "Serowe"];
export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
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
        setFeaturedProviders(
          payload.providers.filter((provider: Provider) => provider.verified).slice(0, 6)
        );
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
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.86fr] lg:px-8 lg:py-14">
        <div className="flex flex-col justify-center">
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] text-[var(--brand-ink)] sm:text-6xl lg:text-7xl">
            Find childcare Botswana families can trust.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--brand-muted)]">
            Search verified schools, nurseries, nannies, babysitters, pediatric
            clinics, and early tutors. Compare fees, reviews, availability, and
            contact providers from one calm workspace.
          </p>

          <div className="mt-8 brand-card p-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-muted)]" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search nurseries, nannies, schools..."
                  className="h-12 rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)] pl-10 text-[var(--brand-ink)] focus-visible:ring-[var(--brand-leaf)]"
                />
              </div>
              <Select value={selectedLocation} onValueChange={(value) => setSelectedLocation(value ?? "")}>
                <SelectTrigger className="h-12 rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)]">
                  <MapPin className="mr-2 h-4 w-4 text-[var(--brand-coral)]" />
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((location) => (
                    <SelectItem key={location} value={location.toLowerCase()}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Link href={`/search?q=${searchQuery}&location=${selectedLocation}`}>
                <Button className="h-12 w-full rounded-lg bg-[var(--brand-leaf)] px-6 font-black text-white hover:bg-[var(--brand-ink)]">
                  Search
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORIES.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.id}`}
                className="rounded-full border border-[var(--brand-line)] bg-white px-3 py-2 text-sm font-bold text-[var(--brand-ink)] transition-colors hover:border-[var(--brand-leaf)]"
              >
                <span className="mr-1.5">{category.icon}</span>
                {category.name}
              </Link>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              [String(marketplaceProviders.length), "listed providers"],
              [String(verifiedProviderCount), "verified profiles"],
              [String(CATEGORIES.length), "service categories"],
            ].map(([value, label]) => (
              <div key={label} className="border-l-2 border-[var(--brand-gold)] pl-4">
                <div className="text-2xl font-black text-[var(--brand-ink)]">{value}</div>
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <div className="brand-card w-full overflow-hidden">
            <div className="border-b border-[var(--brand-line)] bg-[var(--brand-ink)] p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-black">Provider desk</div>
                  <div className="text-xs text-white/65">Gaborone care search</div>
                </div>
                <div className="rounded-full bg-[var(--brand-gold)] px-3 py-1 text-xs font-black text-[var(--brand-ink)]">
                  Verified first
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  [ShieldCheck, "Safety", "ID + docs"],
                  [SlidersHorizontal, "Fit", "Fees + hours"],
                  [MessageCircle, "Contact", "Direct chat"],
                ].map(([Icon, title, body]) => {
                  const TypedIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={title as string} className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-3">
                      <TypedIcon className="mb-3 h-5 w-5 text-[var(--brand-leaf)]" />
                      <div className="text-sm font-black text-[var(--brand-ink)]">{title as string}</div>
                      <div className="text-xs text-[var(--brand-muted)]">{body as string}</div>
                    </div>
                  );
                })}
              </div>
              {featuredProviders.slice(0, 3).map((provider) => (
                <div key={provider.id} className="flex items-center gap-3 rounded-lg border border-[var(--brand-line)] bg-white p-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--brand-ivory)] text-xl">
                    {CATEGORIES.find((category) => category.id === provider.category)?.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-[var(--brand-ink)]">{provider.name}</div>
                    <div className="flex items-center gap-2 text-xs text-[var(--brand-muted)]">
                      <MapPin className="h-3 w-3 text-[var(--brand-coral)]" />
                      <span className="truncate">{provider.location}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-sm font-black text-[var(--brand-ink)]">
                      <Star className="h-3.5 w-3.5 fill-[var(--brand-gold)] text-[var(--brand-gold)]" />
                      {provider.rating}
                    </div>
                    <div className="text-xs font-bold text-[var(--brand-muted)]">P {provider.price.toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {featuredProviders.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-8 text-center text-sm text-[var(--brand-muted)]">
                  Verified provider listings will appear here after approval.
                </div>
              )}
            </div>
          </div>
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
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--brand-ivory)] text-[var(--brand-leaf)]">
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
          <Link href="/search" className="inline-flex items-center gap-2 text-sm font-black text-[var(--brand-leaf)]">
            View all providers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((category) => (
            <Link key={category.id} href={`/search?category=${category.id}`} className="brand-card p-4 transition-transform hover:-translate-y-0.5">
              <div className="text-3xl">{category.icon}</div>
              <div className="mt-4 text-sm font-black text-[var(--brand-ink)]">{category.name}</div>
              <div className="mt-1 text-xs font-bold text-[var(--brand-muted)]">
                {categoryCounts.get(category.id) ?? 0} providers
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="brand-label">Verified results</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--brand-ink)]">Featured providers</h2>
          </div>
          <Link href="/compare">
            <Button variant="outline" className="rounded-lg border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
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
        <div className="mx-auto grid max-w-7xl gap-8 rounded-lg bg-[var(--brand-ink)] p-6 text-white md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-gold)]">For providers</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black">List your childcare service and manage trust from one dashboard.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Add your profile, fees, documents, service areas, availability, and parent messages.
              Kidcexcellence keeps discovery and verification in one place.
            </p>
          </div>
          <div className="flex items-center">
            <Link href="/auth">
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
