"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/kidcellence/Icon";
import { ProviderCard } from "@/components/kidcellence/ProviderCard";
import type { Category, Provider } from "@/lib/mock-data";
import {
  filterProviderList,
  getAdditionalPlatformCategories,
  getCategoryLabel,
  getCoreServiceCategories,
} from "@/lib/platform-service";
import { categoryIcon } from "@/lib/kidcellence/provider-display";
import { routes } from "@/lib/kidcellence/routes";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

const LOCATIONS = ["All Locations", "Gaborone", "Francistown", "Maun", "Kasane", "Lobatse", "Serowe"];
const CORE_CATEGORIES = getCoreServiceCategories();
const ADDITIONAL_CATEGORIES = getAdditionalPlatformCategories();
const ALL_CATEGORIES: Category[] = [...CORE_CATEGORIES, ...ADDITIONAL_CATEGORIES];
const SORT_OPTIONS = [
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "reviews", label: "Most reviewed" },
];
const MAX_PRICE = 10000;
const MAX_COMPARE = 3;

function chipStyle(on: boolean): CSSProperties {
  return { background: on ? "#f4fbfc" : "#ffffff", borderColor: on ? "#54b2bf" : "#d7edf0", color: on ? "#2a7b86" : "#3f3e44" };
}

const selectStyle: CSSProperties = { fontWeight: 700, color: "#3f3e44", padding: "10px 14px", borderRadius: 12, border: "1px solid #d7edf0", background: "#ffffff", minHeight: 44 };

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category");
  const initialLocation = searchParams.get("location");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [selectedLocation, setSelectedLocation] = useState(
    initialLocation
      ? LOCATIONS.find((location) => location.toLowerCase() === initialLocation.toLowerCase()) ?? "All Locations"
      : "All Locations"
  );
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("rating");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [compareIds, setCompareIds] = useLocalStorageState<string[]>(
    "kidcellence.compareIds",
    [],
    (value): value is string[] => Array.isArray(value)
  );
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const loadProviders = async () => {
      const response = await fetch("/api/providers", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) {
        setLoadState("error");
        return;
      }
      const payload = await response.json().catch(() => null);
      if (Array.isArray(payload?.providers)) setProviders(payload.providers);
      setLoadState("ready");
    };
    void loadProviders();
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedLocation("All Locations");
    setMaxPrice(MAX_PRICE);
    setVerifiedOnly(false);
  };

  const filteredProviders = useMemo(() => {
    return filterProviderList(providers, {
      q: searchQuery,
      categories: selectedCategories,
      location: selectedLocation,
      maxPrice,
      verifiedOnly,
      sortBy: sortBy as "rating" | "price_asc" | "price_desc" | "reviews",
    });
  }, [providers, searchQuery, selectedCategories, selectedLocation, maxPrice, verifiedOnly, sortBy]);

  const compareFull = compareIds.length >= MAX_COMPARE;
  const compareNames = compareIds.map((id) => ({
    id,
    name: providers.find((provider) => provider.id === id)?.name ?? "Saved provider",
  }));

  const headingSubject =
    selectedCategories.length === 1 ? getCategoryLabel(selectedCategories[0]) : "Childcare providers";
  const heading =
    selectedLocation !== "All Locations" ? `${headingSubject} in ${selectedLocation}` : headingSubject;
  const countLabel = `${filteredProviders.length} ${filteredProviders.length === 1 ? "provider" : "providers"}${verifiedOnly ? " · verified only" : ""}`;

  return (
    <div style={{ color: "#3f3e44", background: "#f4fbfc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 16px 64px", display: "flex", flexDirection: "column", gap: 24 }}>
        <form
          role="search"
          aria-label="Search providers"
          onSubmit={(event) => event.preventDefault()}
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, background: "#ffffff", border: "1px solid #d7edf0", borderRadius: 28, padding: "6px 6px 6px 18px", boxShadow: "0 4px 14px rgba(63,62,68,.05)" }}
        >
          <Icon name="search" size={20} color="#2a7b86" strokeWidth={2} />
          <label style={{ flex: "1 1 220px", minWidth: 0, display: "flex" }}>
            <span className="kc-sr-only">Search providers</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, town, category or service"
              style={{ flex: 1, minWidth: 0, minHeight: 44, border: 0, outline: 0, background: "transparent", fontSize: 16, fontWeight: 600, color: "#3f3e44" }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderLeft: "1px solid #d7edf0" }}>
            <Icon name="pin" size={18} color="#2a7b86" />
            <span className="kc-sr-only">Town</span>
            <select
              value={selectedLocation}
              onChange={(event) => setSelectedLocation(event.target.value)}
              style={{ border: 0, outline: 0, background: "transparent", fontSize: 15, fontWeight: 600, color: "#3f3e44", minHeight: 44 }}
            >
              {LOCATIONS.map((location) => (
                <option key={location} value={location}>{location === "All Locations" ? "All towns" : location}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="kc-btn" style={{ boxShadow: "none" }}>Search</button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: "#686973" }}>
              <Link href={routes.home} style={{ color: "#2a7b86" }}>Home</Link> / <span>Browse</span>
            </nav>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1 }}>{heading}</h1>
            <p style={{ margin: 0, color: "#686973", fontSize: 16 }} aria-live="polite">
              {loadState === "loading" ? "Loading providers…" : countLabel}
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: "#686973" }}>
            Sort by
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={selectStyle}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Category circles */}
        <div role="group" aria-label="Categories" style={{ display: "flex", gap: 14, overflowX: "auto", padding: "4px 2px 8px" }}>
          {ALL_CATEGORIES.map((category) => {
            const active = selectedCategories.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCategory(category.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: "0 0 auto", width: 96, background: "transparent", border: 0, padding: 0, color: "#3f3e44" }}
              >
                <span
                  style={active
                    ? { width: 68, height: 68, borderRadius: "50%", background: "#2a7b86", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px #ffffff, 0 0 0 6px #54b2bf" }
                    : { width: 68, height: 68, borderRadius: "50%", background: "#ffffff", border: "1px solid #d7edf0", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Icon name={categoryIcon(category.id)} size={28} color={active ? "#ffffff" : "#2a7b86"} strokeWidth={1.8} />
                </span>
                <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, lineHeight: 1.25, textAlign: "center" }}>
                  {category.label ?? category.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, background: "#ffffff", padding: 14, borderRadius: 20, boxShadow: "0 4px 14px rgba(63,62,68,.05)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="kc-chip"
              aria-expanded={showMoreFilters}
              aria-controls="kc-more-filters"
              onClick={() => setShowMoreFilters((open) => !open)}
              style={{ background: "#3f3e44", color: "#ffffff", borderColor: "#3f3e44" }}
            >
              <Icon name="filter" size={18} color="#ffffff" strokeWidth={2} />
              {showMoreFilters ? "Hide filters" : "More filters"}
            </button>
            <button
              type="button"
              className="kc-chip"
              aria-pressed={verifiedOnly}
              onClick={() => setVerifiedOnly((value) => !value)}
              style={chipStyle(verifiedOnly)}
            >
              <Icon name={verifiedOnly ? "check" : "shieldCheck"} size={16} color="#2a7b86" strokeWidth={2.2} />
              Verified only
            </button>
            {maxPrice < MAX_PRICE && (
              <button type="button" className="kc-chip" onClick={() => setMaxPrice(MAX_PRICE)} style={chipStyle(true)} aria-label={`Remove max price P${maxPrice.toLocaleString()}`}>
                Up to P{maxPrice.toLocaleString()}
                <Icon name="x" size={14} color="#2a7b86" strokeWidth={2.4} />
              </button>
            )}
            {selectedCategories.length > 1 && (
              <span style={{ fontSize: 14, fontWeight: 700, color: "#686973" }}>{selectedCategories.length} categories</span>
            )}
            <button
              type="button"
              onClick={clearFilters}
              style={{ marginLeft: "auto", fontWeight: 700, fontSize: 14, color: "#2a7b86", background: "none", border: 0, minHeight: 44, padding: "0 8px", textDecoration: "underline" }}
            >
              Clear all
            </button>
          </div>
          {showMoreFilters && (
            <div id="kc-more-filters" style={{ display: "flex", flexWrap: "wrap", gap: 20, borderTop: "1px solid #d7edf0", paddingTop: 14 }}>
              <label style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>
                  Max price: <span style={{ color: "#2a7b86" }}>P{maxPrice.toLocaleString()}</span>
                </span>
                <input
                  type="range"
                  min={100}
                  max={MAX_PRICE}
                  step={100}
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(Number(event.target.value))}
                  style={{ width: "100%", accentColor: "#2a7b86", minHeight: 44 }}
                />
                <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#686973" }}>
                  <span>P100</span>
                  <span>P10,000</span>
                </span>
              </label>
            </div>
          )}
        </div>

        {loadState === "error" && (
          <p role="alert" style={{ margin: 0, background: "#fff5d3", color: "#c2412a", fontWeight: 700, padding: "14px 18px", borderRadius: 16 }}>
            We could not load providers right now. Please refresh the page to try again.
          </p>
        )}

        {loadState !== "loading" && filteredProviders.length === 0 ? (
          <div style={{ background: "#ffffff", borderRadius: 24, padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <strong style={{ fontSize: 20 }}>No providers found</strong>
            <span style={{ color: "#686973" }}>Try another town, a different search, or clear a filter.</span>
            <button
              type="button"
              className="kc-btn"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategories([]);
                setSelectedLocation("All Locations");
                setVerifiedOnly(false);
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 24 }}>
            {filteredProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                headingLevel="h2"
                onToggleCompare={toggleCompare}
                inCompare={compareIds.includes(provider.id)}
                compareDisabled={compareFull}
              />
            ))}
          </div>
        )}
      </div>

      {/* Compare tray */}
      {compareIds.length > 0 && (
        <div style={{ position: "sticky", bottom: 0, background: "#3f3e44", color: "#ffffff", zIndex: 20 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Icon name="compare" size={22} color="#54b2bf" strokeWidth={2} />
            <strong style={{ fontSize: 15 }}>Compare ({compareIds.length} of {MAX_COMPARE})</strong>
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
              {compareNames.map((item) => (
                <span key={item.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,.12)", padding: "2px 4px 2px 12px", borderRadius: 999, fontSize: 14, fontWeight: 600, maxWidth: "100%" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name} from compare`}
                    onClick={() => toggleCompare(item.id)}
                    style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Icon name="x" size={14} color="#ffffff" strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </span>
            {compareIds.length >= 2 ? (
              <Link
                href={routes.compare}
                style={{ marginLeft: "auto", padding: "12px 22px", borderRadius: 999, background: "#ffcc2f", color: "#3f3e44", fontWeight: 800, fontSize: 15, textDecoration: "none" }}
              >
                Compare side by side
              </Link>
            ) : (
              <span style={{ marginLeft: "auto", fontSize: 14, color: "#d7edf0" }}>Pick one more to compare</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", padding: 32, color: "#686973", background: "#f4fbfc" }}>Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
