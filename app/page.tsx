"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/kidcellence/Icon";
import { ProviderCard } from "@/components/kidcellence/ProviderCard";
import { HeroIllustration } from "@/components/kidcellence/home/HeroIllustration";
import { routes } from "@/lib/kidcellence/routes";
import { categoryIcon } from "@/lib/kidcellence/provider-display";
import { VETTING_PACKAGES } from "@/lib/vetting-packages";
import {
  ADDITIONAL_PLATFORM_CATEGORIES,
  CATEGORIES,
  CORE_SERVICE_CATEGORY_COUNT,
  CORE_SERVICE_CATEGORIES,
  type Provider,
} from "@/lib/mock-data";

// Towns the /search page accepts as a location filter.
const TOWNS = ["Gaborone", "Francistown", "Maun", "Kasane", "Lobatse", "Serowe"];

const POPULAR = [
  { label: "Nannies", category: "nannies" },
  { label: "Schools", category: "schools" },
  { label: "Tutors", category: "tutors" },
  { label: "Speech therapy", category: "pediatric-therapy" },
];

// Listing tabs: each groups real category ids.
const TABS: { label: string; categories: string[] | null }[] = [
  { label: "All", categories: null },
  { label: "Nannies", categories: ["nannies", "babysitters", "helpers"] },
  { label: "Schools", categories: ["schools", "nurseries"] },
  { label: "Tutors", categories: ["tutors"] },
  { label: "Therapy", categories: ["pediatric-therapy", "child-psychologists", "pediatric-clinics"] },
];

// Category circle colours, in the design's order.
const TILE_STYLES: { bg: string; stroke: string; border?: boolean; size: number }[] = [
  { bg: "#54b2bf", stroke: "#ffffff", size: 44 },
  { bg: "#ffcc2f", stroke: "#3f3e44", size: 44 },
  { bg: "#f05a3c", stroke: "#ffffff", size: 44 },
  { bg: "#3f3e44", stroke: "#ffffff", size: 44 },
];
const tileStyle = (index: number) =>
  TILE_STYLES[index] ?? (index % 2 === 0
    ? { bg: "#f4fbfc", stroke: "#2a7b86", border: true, size: 40 }
    : { bg: "#fff5d3", stroke: "#3f3e44", size: 40 });

function getVettingEnquiryHref(packageName: string, price: number) {
  const message = `Hi Kidcellence, I would like to enquire about the ${packageName} Vet With Us Package. The listed price is P${price}.`;
  return `https://wa.me/26775378699?text=${encodeURIComponent(message)}`;
}

const STEPS = [
  { n: "1", bg: "#f4fbfc", badgeBg: "#54b2bf", badgeFg: "#ffffff", title: "Search and compare", body: "Filter by category, town and verification. Add up to three providers to Compare and see them side by side." },
  { n: "2", bg: "#fff5d3", badgeBg: "#ffcc2f", badgeFg: "#3f3e44", title: "Check the badge", body: "Verified means our team reviewed that category's documents. For a nanny: certified ID, CV, proof of residence and police clearance." },
  { n: "3", bg: "#f4fbfc", badgeBg: "#54b2bf", badgeFg: "#ffffff", title: "Message and meet", body: "Chat in Kidcellence Messages, share your children's details from your profile when you are ready, and arrange to meet." },
];

const container: CSSProperties = { maxWidth: 1280, margin: "0 auto", paddingLeft: 24, paddingRight: 24 };
const sectionHeading: CSSProperties = { margin: 0, fontSize: "clamp(28px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.15 };
const fieldLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#686973", textTransform: "uppercase", letterSpacing: ".6px" };
const chipLink: CSSProperties = { padding: "8px 14px", borderRadius: 999, background: "#ffffff", border: "1px solid #d7edf0", fontSize: 14, fontWeight: 600, color: "#3f3e44", textDecoration: "none" };

type LoadState = "loading" | "ready" | "error";

export default function HomePage() {
  const router = useRouter();
  const [featuredProviders, setFeaturedProviders] = useState<Provider[]>([]);
  const [marketplaceProviders, setMarketplaceProviders] = useState<Provider[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tab, setTab] = useState(TABS[0].label);
  const [query, setQuery] = useState("");
  const [town, setTown] = useState("");

  useEffect(() => {
    const loadFeaturedProviders = async () => {
      const response = await fetch("/api/providers", {
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok) {
        setLoadState("error");
        return;
      }
      const payload = await response.json().catch(() => null);
      if (Array.isArray(payload?.providers)) {
        setMarketplaceProviders(payload.providers);
        const featured = payload.providers.filter((provider: Provider) => provider.featured);
        const verified = payload.providers.filter((provider: Provider) => provider.verified);
        // Featured listings first when any exist, then other verified listings.
        setFeaturedProviders([
          ...featured,
          ...verified.filter((provider: Provider) => !provider.featured),
        ]);
        setLoadState("ready");
      } else {
        setLoadState("error");
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
  const countFor = (categoryId: string) =>
    categoryId === "schools"
      ? (categoryCounts.get("schools") ?? 0) + (categoryCounts.get("nurseries") ?? 0)
      : categoryCounts.get(categoryId) ?? 0;

  const activeTab = TABS.find((item) => item.label === tab) ?? TABS[0];
  const shown = featuredProviders
    .filter((provider) => !activeTab.categories || activeTab.categories.includes(provider.category))
    .slice(0, 8);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(routes.search({ q: query.trim() || undefined, location: town || undefined }));
  };

  const tiles = [...CORE_SERVICE_CATEGORIES, ...ADDITIONAL_PLATFORM_CATEGORIES];

  return (
    <div style={{ color: "#3f3e44", background: "#ffffff", minWidth: 0, overflowX: "hidden" }}>
      {/* Hero */}
      <section style={{ background: "#f4fbfc", overflow: "hidden" }}>
        <div style={{ ...container, paddingTop: "clamp(28px, 6vw, 72px)", paddingBottom: "clamp(32px, 7vw, 88px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 48 }}>
          <div style={{ flex: "1 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, background: "#fff5d3", color: "#3f3e44", padding: "8px 14px", borderRadius: 999, fontSize: 14, fontWeight: 700 }}>
              <Icon name="shieldCheck" size={16} color="#2a7b86" strokeWidth={2.2} />
              Verified childcare across Botswana
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(36px, 7vw, 64px)", lineHeight: 1.05, fontWeight: 800, letterSpacing: "-1.5px" }}>
              Find care your family can <span style={{ color: "#2a7b86" }}>trust</span>, close to home.
            </h1>
            <p style={{ margin: 0, fontSize: "clamp(16px, 2.2vw, 19px)", lineHeight: 1.6, color: "#686973", maxWidth: 560 }}>
              Kidcellence is an all-in-one hub for schools, nannies, tutors, clinics and other child related services. Compare providers across Botswana, then message them directly.
            </p>

            <form role="search" aria-label="Find a provider" onSubmit={handleSearch} style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 8, background: "#ffffff", padding: 8, borderRadius: 24, boxShadow: "0 18px 44px rgba(30,30,40,.12)", border: "1px solid #d7edf0", marginTop: 8 }}>
              <label style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 16, minWidth: 0 }}>
                <Icon name="search" size={22} color="#2a7b86" strokeWidth={2} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={fieldLabel}>What do you need?</span>
                  <input
                    type="search"
                    name="q"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nanny, preschool, tutor…"
                    style={{ border: 0, outline: 0, fontSize: 17, fontWeight: 600, color: "#3f3e44", background: "transparent", padding: 0, minWidth: 0, width: "100%" }}
                  />
                </span>
              </label>
              <label style={{ flex: "1 1 170px", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 16, minWidth: 0, borderLeft: "1px solid #d7edf0" }}>
                <Icon name="pin" size={22} color="#2a7b86" strokeWidth={2} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={fieldLabel}>Where?</span>
                  <select
                    name="location"
                    value={town}
                    onChange={(event) => setTown(event.target.value)}
                    style={{ border: 0, outline: 0, fontSize: 17, fontWeight: 600, color: "#3f3e44", background: "transparent", padding: 0, width: "100%" }}
                  >
                    <option value="">Anywhere in Botswana</option>
                    {TOWNS.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </span>
              </label>
              <button type="submit" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 30px", minHeight: 60, borderRadius: 18, background: "#2a7b86", color: "#ffffff", fontWeight: 800, fontSize: 17, border: 0, flex: "1 0 auto" }}>
                Search
              </button>
            </form>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "#686973", fontWeight: 600 }}>Popular:</span>
              {POPULAR.map((item) => (
                <Link key={item.category} href={routes.search({ category: item.category })} style={chipLink}>{item.label}</Link>
              ))}
            </div>
          </div>

          <div className="kc-desktop-only" style={{ flex: "1 1 400px", minWidth: 0 }}>
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* Live marketplace figures */}
      <section style={{ background: "#ffffff", borderBottom: "1px solid #d7edf0" }}>
        <div style={{ ...container, paddingTop: 28, paddingBottom: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
          {[
            [String(marketplaceProviders.length), "listed providers"],
            [String(verifiedProviderCount), "verified profiles"],
            [String(CORE_SERVICE_CATEGORY_COUNT), "service categories"],
          ].map(([value, label]) => (
            <div key={label} style={{ background: "#f4fbfc", borderRadius: 20, padding: "16px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>{loadState === "loading" && label !== "service categories" ? "…" : value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "#686973" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section style={{ background: "#ffffff" }}>
        <div style={{ ...container, paddingTop: "clamp(48px, 8vw, 80px)", paddingBottom: 56, display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 style={sectionHeading}>Browse by category</h2>
              <p style={{ margin: 0, fontSize: 17, color: "#686973" }}>From everyday care to specialist support, every listing follows its own verification checklist.</p>
            </div>
            <Link href={routes.browse} style={{ fontWeight: 700, fontSize: 15, color: "#2a7b86" }}>View all providers</Link>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "32px 16px", justifyContent: "center" }}>
            {tiles.map((category, index) => {
              const style = tileStyle(index);
              const count = countFor(category.id);
              const subcategories = category.subcategories?.map((item) => item.name).join(", ");
              return (
                <Link
                  key={category.id}
                  href={routes.search({ category: category.id })}
                  title={subcategories ? `Includes: ${subcategories}` : undefined}
                  style={{ width: 148, maxWidth: "calc(50% - 8px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", textDecoration: "none", color: "#3f3e44" }}
                >
                  <span style={{ width: 104, height: 104, borderRadius: "50%", background: style.bg, display: "flex", alignItems: "center", justifyContent: "center", ...(style.border ? { border: "1px solid #d7edf0" } : {}) }}>
                    <Icon name={categoryIcon(category.id)} size={style.size} color={style.stroke} strokeWidth={1.7} />
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{category.label ?? category.name}</span>
                  <span style={{ fontSize: 13, color: "#686973", marginTop: -4 }}>
                    {loadState === "ready" ? `${count} ${count === 1 ? "provider" : "providers"}` : " "}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Verified listings */}
      <section style={{ background: "#f4fbfc" }}>
        <div style={{ ...container, paddingTop: "clamp(48px, 8vw, 80px)", paddingBottom: "clamp(48px, 8vw, 80px)", display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ alignSelf: "flex-start", background: "#ffcc2f", color: "#3f3e44", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999, letterSpacing: ".4px" }}>VERIFIED PROVIDERS</span>
              <h2 style={sectionHeading}>Checked by our team</h2>
            </div>
            {featuredProviders.length > 0 && (
              <div role="group" aria-label="Filter verified providers" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TABS.map((item) => {
                  const on = item.label === tab;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTab(item.label)}
                      style={{ fontWeight: 700, fontSize: 14, padding: "10px 18px", minHeight: 44, borderRadius: 999, border: `1px solid ${on ? "#3f3e44" : "#d7edf0"}`, background: on ? "#3f3e44" : "#ffffff", color: on ? "#ffffff" : "#3f3e44" }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loadState === "loading" ? (
            <p role="status" style={{ margin: 0, padding: "40px 24px", textAlign: "center", color: "#686973", fontWeight: 700, background: "#ffffff", borderRadius: 24 }}>
              Loading providers…
            </p>
          ) : loadState === "error" ? (
            <div role="alert" style={{ padding: "40px 24px", textAlign: "center", background: "#ffffff", borderRadius: 24, border: "1px dashed #d7edf0" }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Listings could not load right now</h3>
              <p style={{ margin: "8px auto 0", maxWidth: 480, fontSize: 15, color: "#686973" }}>Please refresh the page in a moment, or <Link href={routes.browse}>browse all providers</Link>.</p>
            </div>
          ) : shown.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", background: "#ffffff", borderRadius: 24, border: "1px dashed #d7edf0" }}>
              <Icon name="shieldCheck" size={32} color="#2a7b86" />
              <h3 style={{ margin: "12px 0 0", fontSize: 19, fontWeight: 800 }}>
                {featuredProviders.length === 0 ? "Verified listings are being prepared" : `No verified ${activeTab.label.toLowerCase()} yet`}
              </h3>
              <p style={{ margin: "8px auto 0", maxWidth: 480, fontSize: 15, color: "#686973" }}>
                Published provider profiles appear here after document review and approval.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 24 }}>
              {shown.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href={routes.browse} className="kc-btn-outline">Browse all providers</Link>
            <Link href={routes.compare} className="kc-btn-outline">Compare providers</Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "#ffffff" }}>
        <div style={{ ...container, paddingTop: "clamp(56px, 9vw, 88px)", paddingBottom: "clamp(56px, 9vw, 88px)", display: "flex", flexDirection: "column", gap: 40 }}>
          <h2 style={{ ...sectionHeading, textAlign: "center" }}>How Kidcellence works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 24 }}>
            {STEPS.map((step) => (
              <div key={step.n} style={{ background: step.bg, borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ width: 52, height: 52, borderRadius: "50%", background: step.badgeBg, color: step.badgeFg, fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{step.n}</span>
                <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#686973" }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vet With Us */}
      <section id="vet-with-us" style={{ background: "#fff5d3" }}>
        <div style={{ ...container, paddingTop: "clamp(56px, 9vw, 88px)", paddingBottom: "clamp(56px, 9vw, 88px)", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 400px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ alignSelf: "flex-start", background: "#ffffff", color: "#c2412a", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999, letterSpacing: ".4px" }}>VET WITH US</span>
            <h2 style={{ ...sectionHeading, fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.1 }}>Found someone you like? Let us vet them for you.</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#686973" }}>Already have a nanny or helper in mind? Our team runs the checks so you can hire with confidence. View the packages, then send an enquiry to Kidcellence on WhatsApp.</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Link href={routes.pricing} style={{ fontWeight: 700, color: "#2a7b86" }}>See what&apos;s included</Link>
              <Link href={routes.safety} style={{ fontWeight: 700, color: "#2a7b86" }}>How verification works</Link>
            </div>
          </div>
          <div style={{ flex: "1 1 480px", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 20 }}>
            {VETTING_PACKAGES.map((pkg) => {
              const premium = pkg.id === "vip";
              return (
                <div key={pkg.id} style={{ background: "#ffffff", borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 10px 30px rgba(30,30,40,.08)", outline: premium ? "3px solid #ffcc2f" : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{pkg.name}</h3>
                    {premium && <span style={{ background: "#ffcc2f", color: "#3f3e44", fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999 }}>Priority</span>}
                  </div>
                  <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-1px" }}>P{pkg.price}</span>
                    <span style={{ color: "#686973", fontSize: 15 }}>once-off</span>
                  </p>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#686973" }}>{pkg.summary}</p>
                  <a
                    href={getVettingEnquiryHref(pkg.name, pkg.price)}
                    target="_blank"
                    rel="noreferrer"
                    className={premium ? "kc-btn" : "kc-btn-outline"}
                    style={{ marginTop: "auto", borderRadius: 14 }}
                  >
                    <Icon name="message" size={18} />
                    Enquire about {pkg.name}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Provider CTA */}
      <section style={{ background: "#ffffff" }}>
        <div style={{ ...container, paddingTop: "clamp(40px, 8vw, 80px)", paddingBottom: "clamp(40px, 8vw, 80px)" }}>
          <div style={{ background: "#54b2bf", borderRadius: 32, padding: "clamp(28px, 6vw, 56px)", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ ...sectionHeading, fontSize: "clamp(26px, 5vw, 38px)", lineHeight: 1.1, color: "#3f3e44" }}>Care for children? Get found by Botswana&apos;s parents.</h2>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#3f3e44" }}>First month free. Then P60/month for nannies, helpers and babysitters, P150/month for schools, therapists and other providers.</p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href={routes.providerSignup} style={{ padding: "16px 28px", borderRadius: 999, background: "#ffffff", color: "#2a7b86", fontWeight: 800, fontSize: 16, textDecoration: "none", boxShadow: "0 10px 24px rgba(30,30,40,.15)" }}>List your service</Link>
              <Link href={routes.pricing} style={{ padding: "16px 28px", borderRadius: 999, background: "#3f3e44", color: "#ffffff", fontWeight: 800, fontSize: 16, textDecoration: "none" }}>See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
