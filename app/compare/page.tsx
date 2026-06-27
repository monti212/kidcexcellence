"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Provider } from "@/lib/mock-data";
import {
  getCategoryIcon,
  getCategoryLabel,
} from "@/lib/platform-service";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import {
  CheckCircle2,
  X,
  Star,
  MapPin,
  Plus,
  BarChart2,
  Trash2,
} from "lucide-react";

function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryIds = searchParams.get("ids");
  const [storedCompareIds, setCompareIds] = useLocalStorageState<string[]>(
    "kidcexcellence.compareIds",
    [],
    (value): value is string[] =>
      Array.isArray(value) &&
      value.length <= 3 &&
      value.every((item) => typeof item === "string")
  );
  const compareIds = useMemo(() => storedCompareIds.slice(0, 3), [storedCompareIds]);

  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    if (!queryIds) return;
    const importedIds = [...new Set(queryIds.split(",").map((id) => id.trim()).filter(Boolean))]
      .slice(0, 3);
    setCompareIds(importedIds);
    router.replace("/compare");
  }, [queryIds, router, setCompareIds]);

  useEffect(() => {
    const loadProviders = async () => {
      const response = await fetch(
        `/api/compare?ids=${encodeURIComponent(compareIds.join(","))}`,
        { cache: "no-store" }
      ).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload.providers)) setProviders(payload.providers);
    };
    void loadProviders();
  }, [compareIds]);

  const removeProvider = (id: string) => {
    setCompareIds((prev) => prev.filter((c) => c !== id));
  };

  return (
    <div className="brand-page min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--brand-ink)" }}
          >
            <BarChart2 className="w-5 h-5 text-[var(--brand-gold)]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-[var(--brand-ink)]">Compare Providers</h1>
            <p className="text-sm text-[var(--brand-muted)]">Side-by-side comparison to help you choose</p>
          </div>
        </div>

        {providers.length < 2 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">⚖️</div>
            <h2 className="text-2xl font-bold text-[var(--brand-ink)] mb-3">
              Select at least 2 providers to compare
            </h2>
            <p className="text-[var(--brand-muted)] mb-8 max-w-md mx-auto">
              Browse our provider listing, then use the &quot;Compare&quot; button on each card to add them here.
            </p>
            <Link href="/search">
              <Button
                size="lg"
                className="rounded-lg text-white font-semibold px-8"
                style={{ background: "var(--brand-leaf)" }}
              >
                Browse Providers
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Comparison Table */}
            <div className="overflow-x-auto">
              <div
                className="inline-grid min-w-full gap-0"
                style={{ gridTemplateColumns: `200px repeat(${providers.length}, minmax(220px, 1fr))` }}
              >
                {/* Header Row — photos */}
                <div className="bg-transparent" />
                {providers.map((p) => (
                  <div key={p.id} className="bg-white rounded-t-2xl border border-[var(--brand-line)] border-b-0 p-5 text-center relative mx-1">
                    <button
                      onClick={() => removeProvider(p.id)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                      aria-label={`Remove ${p.name} from comparison`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] text-3xl">
                      {getCategoryIcon(p.category)}
                    </div>
                    <h3 className="font-bold text-[var(--brand-ink)] text-sm leading-tight mb-1">{p.name}</h3>
                    <Badge className="rounded-md border-0 bg-[var(--brand-ivory)] text-xs text-[var(--brand-leaf)]">
                      {getCategoryLabel(p.category)}
                    </Badge>
                  </div>
                ))}

                {/* Rows */}
                {[
                  {
                    label: "Location",
                    render: (p: Provider) => (
                      <span className="flex items-center gap-1 text-[var(--brand-ink)] text-sm">
                        <MapPin className="w-3.5 h-3.5 text-[var(--brand-leaf)] shrink-0" />
                        {p.location}
                      </span>
                    ),
                  },
                  {
                    label: "Rating",
                    render: (p: Provider) => (
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="font-semibold text-[var(--brand-ink)]">{p.rating}</span>
                        <span className="text-gray-400 text-xs">({p.reviewCount})</span>
                      </span>
                    ),
                  },
                  {
                    label: "Price",
                    render: (p: Provider) => (
                      <span className="font-bold text-[var(--brand-ink)]">
                        P {p.price.toLocaleString()}{" "}
                        <span className="font-normal text-gray-400 text-xs">/{p.priceUnit}</span>
                      </span>
                    ),
                  },
                  {
                    label: "Verified",
                    render: (p: Provider) =>
                      p.verified ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Verified
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Not verified</span>
                      ),
                  },
                  {
                    label: "Experience",
                    render: (p: Provider) => (
                      <span className="text-[var(--brand-ink)] text-sm">{p.experience}</span>
                    ),
                  },
                  {
                    label: "Availability",
                    render: (p: Provider) => (
                      <span className="text-[var(--brand-ink)] text-sm">{p.availability}</span>
                    ),
                  },
                  {
                    label: "Services",
                    render: (p: Provider) => (
                      <div className="flex flex-wrap gap-1">
                        {p.services.slice(0, 3).map((s) => (
                          <span key={s} className="bg-[var(--brand-ivory)] text-[var(--brand-leaf)] rounded-full px-2 py-0.5 text-xs">
                            {s}
                          </span>
                        ))}
                        {p.services.length > 3 && (
                          <span className="text-gray-400 text-xs">+{p.services.length - 3} more</span>
                        )}
                      </div>
                    ),
                  },
                ].map((row) => (
                <Fragment key={row.label}>
                    <div
                      key={`label-${row.label}`}
                      className="flex items-center border-y border-l border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-4 text-sm font-black text-[var(--brand-ink)]"
                    >
                      {row.label}
                    </div>
                    {providers.map((p) => (
                      <div
                        key={`${p.id}-${row.label}`}
                        className="mx-1 flex items-center border-y border-r border-[var(--brand-line)] bg-white px-5 py-4"
                      >
                        {row.render(p)}
                      </div>
                    ))}
                </Fragment>
                ))}

                {/* Fees comparison (schools only) */}
                {providers.some((p) => p.fees) && (
                  <>
                    <div className="flex items-center border-y border-l border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-4 text-sm font-black text-[var(--brand-leaf)]">
                      Fee Structure
                    </div>
                    {providers.map((p) => (
                      <div key={`fees-${p.id}`} className="mx-1 border-y border-r border-[var(--brand-line)] bg-white px-5 py-4">
                        {p.fees ? (
                          <div className="text-xs space-y-1">
                            {p.fees.slice(0, 3).map((fee) => (
                              <div key={fee.grade} className="flex justify-between gap-2">
                                <span className="text-[var(--brand-muted)]">{fee.grade}</span>
                                <span className="font-semibold text-[var(--brand-ink)]">P {fee.termly.toLocaleString()}/term</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">N/A</span>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Action row */}
                <div className="bg-transparent" />
                {providers.map((p) => (
                  <div key={`action-${p.id}`} className="bg-white rounded-b-2xl border border-[var(--brand-line)] border-t-0 p-4 mx-1">
                    <Link href={`/provider/${p.id}`}>
                      <Button className="w-full rounded-lg bg-[var(--brand-leaf)] text-sm font-black text-white hover:bg-[var(--brand-ink)]">
                        View Profile
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {providers.length < 3 && (
                <Link href="/search">
                  <Button variant="outline" className="mx-auto flex items-center gap-2 rounded-lg border-[var(--brand-line)] bg-white text-[var(--brand-ink)] hover:bg-[var(--brand-ivory)]">
                    <Plus className="w-4 h-4" />
                    Add Another Provider
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                className="rounded-lg border-[var(--brand-line)] bg-white text-[var(--brand-muted)] hover:bg-[var(--brand-ivory)]"
                onClick={() => setCompareIds([])}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear comparison
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="brand-page min-h-screen p-8 text-[var(--brand-muted)]">Loading comparison...</div>}>
      <ComparePageContent />
    </Suspense>
  );
}
