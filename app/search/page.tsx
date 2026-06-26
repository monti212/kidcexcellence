"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ProviderCard from "@/components/ProviderCard";
import { filterProviders, getCategories } from "@/lib/platform-service";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { CheckCircle2, Map, Search, SlidersHorizontal } from "lucide-react";

const LOCATIONS = ["All Locations", "Gaborone", "Francistown", "Maun", "Kasane", "Lobatse", "Serowe"];
const CATEGORIES = getCategories();
const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "reviews", label: "Most Reviewed" },
];

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
  const [maxPrice, setMaxPrice] = useState(10000);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("rating");
  const [compareIds, setCompareIds] = useLocalStorageState<string[]>(
    "kidcexcellence.compareIds",
    [],
    (value): value is string[] => Array.isArray(value)
  );
  const [showMap, setShowMap] = useState(false);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const activeFilterCount =
    selectedCategories.length +
    (verifiedOnly ? 1 : 0) +
    (selectedLocation !== "All Locations" ? 1 : 0) +
    (maxPrice < 10000 ? 1 : 0);

  const filteredProviders = useMemo(() => {
    return filterProviders({
      q: searchQuery,
      categories: selectedCategories,
      location: selectedLocation,
      maxPrice,
      verifiedOnly,
      sortBy: sortBy as "rating" | "price_asc" | "price_desc" | "reviews",
    });
  }, [searchQuery, selectedCategories, selectedLocation, maxPrice, verifiedOnly, sortBy]);

  const renderFiltersContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 font-black text-[var(--brand-ink)]">Category</h3>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={cat.id}
                checked={selectedCategories.includes(cat.id)}
                onCheckedChange={() => toggleCategory(cat.id)}
                className="border-[var(--brand-line)] data-[state=checked]:bg-[var(--brand-leaf)]"
              />
              <label htmlFor={cat.id} className="flex cursor-pointer select-none items-center gap-2 text-sm font-bold text-[var(--brand-muted)]">
                <span>{cat.icon}</span>
                {cat.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Location */}
      <div>
        <h3 className="mb-3 font-black text-[var(--brand-ink)]">Location</h3>
        <Select value={selectedLocation} onValueChange={(v) => setSelectedLocation(v ?? "All Locations")}>
          <SelectTrigger className="rounded-lg border-[var(--brand-line)] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCATIONS.map((loc) => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">
          Max Price: <span className="text-[var(--brand-leaf)]">P {maxPrice.toLocaleString()}</span>
        </h3>
        <Slider
          value={[maxPrice]}
          onValueChange={(val) => setMaxPrice(Array.isArray(val) ? val[0] : val)}
          min={100}
          max={10000}
          step={100}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>P 100</span>
          <span>P 10,000</span>
        </div>
      </div>

      {/* Verified Only */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="verified"
          checked={verifiedOnly}
          onCheckedChange={(c) => setVerifiedOnly(!!c)}
          className="border-[var(--brand-line)] data-[state=checked]:bg-[var(--brand-leaf)]"
        />
        <label htmlFor="verified" className="flex cursor-pointer items-center gap-1.5 text-sm font-black text-[var(--brand-ink)]">
          <CheckCircle2 className="h-4 w-4 text-[var(--brand-leaf)]" />
          Verified providers only
        </label>
      </div>

      <Button
        variant="outline"
        className="w-full rounded-lg border-[var(--brand-line)] bg-white text-sm font-black text-[var(--brand-muted)]"
        onClick={() => {
          setSelectedCategories([]);
          setSelectedLocation("All Locations");
          setMaxPrice(10000);
          setVerifiedOnly(false);
        }}
      >
        Clear All Filters
      </Button>
    </div>
  );

  return (
    <div className="brand-page min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--brand-line)] bg-white px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search providers, locations..."
                className="h-11 rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)] pl-10 focus-visible:ring-[var(--brand-leaf)]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Mobile filter trigger */}
            <Sheet>
              <SheetTrigger render={<button className="inline-flex items-center gap-2 rounded-lg border border-[var(--brand-line)] bg-white px-3 py-2 text-sm font-black text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-ivory)] lg:hidden" />}>
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-leaf)] text-xs text-white">
                    {activeFilterCount}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto">
                <SheetHeader className="mb-6">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                {renderFiltersContent()}
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              className={`flex items-center gap-2 rounded-lg border-[var(--brand-line)] font-black ${showMap ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]" : "bg-white text-[var(--brand-ink)]"}`}
              onClick={() => setShowMap(!showMap)}
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Map View</span>
            </Button>
            {compareIds.length > 0 && (
              <Link href={`/compare?ids=${compareIds.join(",")}`}>
                <Button className="hidden rounded-lg bg-[var(--brand-ink)] font-black text-white hover:bg-[var(--brand-leaf)] sm:inline-flex">
                  Compare {compareIds.length}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar Filters — Desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="brand-card sticky top-20 p-5">
            <h2 className="mb-5 text-lg font-black text-[var(--brand-ink)]">Filters</h2>
            {renderFiltersContent()}
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {showMap && (
            <div className="brand-card mb-6 h-64 overflow-hidden p-4">
              <div className="relative h-full rounded-lg bg-[linear-gradient(135deg,#e8f3eb,#fff8ec)]">
                <div className="absolute left-[14%] top-[28%] rounded-full bg-[var(--brand-leaf)] px-3 py-1 text-xs font-black text-white shadow-sm">Gaborone</div>
                <div className="absolute right-[18%] top-[18%] rounded-full bg-[var(--brand-coral)] px-3 py-1 text-xs font-black text-white shadow-sm">Phakalane</div>
                <div className="absolute bottom-[22%] left-[34%] rounded-full bg-[var(--brand-gold)] px-3 py-1 text-xs font-black text-[var(--brand-ink)] shadow-sm">Broadhurst</div>
                <div className="absolute inset-x-8 top-1/2 h-px rotate-[-8deg] bg-[var(--brand-line)]" />
                <div className="absolute bottom-4 right-4 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[var(--brand-muted)] shadow-sm">
                  {filteredProviders.length} visible providers
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[var(--brand-muted)]">
              <span className="font-black text-[var(--brand-ink)]">{filteredProviders.length}</span>{" "}
              providers found
            </p>
            <div className="flex items-center gap-2">
              <Label className="hidden text-sm font-bold text-[var(--brand-muted)] sm:block">Sort:</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "rating")}>
                <SelectTrigger className="h-9 w-44 rounded-lg border-[var(--brand-line)] bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredProviders.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="mb-2 text-xl font-black text-[var(--brand-ink)]">No providers found</h3>
              <p className="mb-6 text-[var(--brand-muted)]">Try adjusting your filters or search query</p>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategories([]);
                  setSelectedLocation("All Locations");
                  setVerifiedOnly(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onAddToCompare={toggleCompare}
                  inCompare={compareIds.includes(provider.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="brand-page min-h-screen p-8 text-[var(--brand-muted)]">Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
