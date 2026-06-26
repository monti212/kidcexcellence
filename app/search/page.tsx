"use client";

import { useState, useMemo } from "react";
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
import { PROVIDERS, CATEGORIES } from "@/lib/mock-data";
import { SlidersHorizontal, Search, Map } from "lucide-react";

const LOCATIONS = ["All Locations", "Gaborone", "Francistown", "Maun", "Kasane", "Lobatse", "Serowe"];
const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "reviews", label: "Most Reviewed" },
];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [maxPrice, setMaxPrice] = useState(10000);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("rating");
  const [compareIds, setCompareIds] = useState<string[]>([]);
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

  const filteredProviders = useMemo(() => {
    let result = [...PROVIDERS];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.includes(p.category));
    }

    if (selectedLocation !== "All Locations") {
      result = result.filter((p) =>
        p.location.toLowerCase().includes(selectedLocation.toLowerCase())
      );
    }

    if (verifiedOnly) {
      result = result.filter((p) => p.verified);
    }

    result = result.filter((p) => p.price <= maxPrice);

    if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "price_asc") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") result.sort((a, b) => b.price - a.price);
    else if (sortBy === "reviews") result.sort((a, b) => b.reviewCount - a.reviewCount);

    return result;
  }, [searchQuery, selectedCategories, selectedLocation, maxPrice, verifiedOnly, sortBy]);

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Category</h3>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={cat.id}
                checked={selectedCategories.includes(cat.id)}
                onCheckedChange={() => toggleCategory(cat.id)}
                className="border-purple-300 data-[state=checked]:bg-purple-600"
              />
              <label htmlFor={cat.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <span>{cat.icon}</span>
                {cat.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Location */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Location</h3>
        <Select value={selectedLocation} onValueChange={(v) => setSelectedLocation(v ?? "All Locations")}>
          <SelectTrigger className="rounded-xl border-gray-200">
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
          Max Price: <span style={{ color: "#7C3AED" }}>P {maxPrice.toLocaleString()}</span>
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
          className="border-purple-300 data-[state=checked]:bg-purple-600"
        />
        <label htmlFor="verified" className="text-sm font-medium text-gray-700 cursor-pointer">
          Verified providers only ✓
        </label>
      </div>

      <Button
        variant="outline"
        className="w-full rounded-xl border-gray-200 text-gray-600 text-sm"
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
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search providers, locations..."
                className="pl-10 rounded-xl border-gray-200 focus-visible:ring-purple-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Mobile filter trigger */}
            <Sheet>
              <SheetTrigger render={<button className="lg:hidden inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" />}>
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {(selectedCategories.length > 0 || verifiedOnly) && (
                  <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center" style={{ background: "#7C3AED" }}>
                    {selectedCategories.length + (verifiedOnly ? 1 : 0)}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto">
                <SheetHeader className="mb-6">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <FiltersContent />
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              className={`rounded-xl border-gray-200 flex items-center gap-2 ${showMap ? "bg-purple-50 border-purple-200 text-purple-700" : ""}`}
              onClick={() => setShowMap(!showMap)}
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Map View</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar Filters — Desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20">
            <h2 className="font-bold text-gray-900 text-lg mb-5">Filters</h2>
            <FiltersContent />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {showMap && (
            <div className="bg-white rounded-2xl border border-gray-200 mb-6 h-48 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Map className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Map Coming Soon</p>
                <p className="text-sm">We&apos;re building an interactive map for Botswana</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-900">{filteredProviders.length}</span>{" "}
              providers found
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-500 hidden sm:block">Sort:</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "rating")}>
                <SelectTrigger className="w-44 rounded-xl border-gray-200 text-sm h-9">
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">No providers found</h3>
              <p className="text-gray-500 mb-6">Try adjusting your filters or search query</p>
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
