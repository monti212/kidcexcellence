"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS } from "@/lib/mock-data";
import {
  CheckCircle2,
  X,
  Star,
  MapPin,
  Plus,
  BarChart2,
} from "lucide-react";

// Default to first 3 verified providers for demo
const defaultCompareIds = ["1", "2", "9"];

const categoryLabels: Record<string, string> = {
  schools: "School",
  nurseries: "Nursery",
  nannies: "Nanny",
  babysitters: "Babysitter",
  "pediatric-clinics": "Pediatric Clinic",
  tutors: "Tutor",
};

export default function ComparePage() {
  const [compareIds, setCompareIds] = useState<string[]>(defaultCompareIds);

  const providers = compareIds
    .map((id) => PROVIDERS.find((p) => p.id === id))
    .filter(Boolean) as typeof PROVIDERS;

  const removeProvider = (id: string) => {
    setCompareIds((prev) => prev.filter((c) => c !== id));
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7C3AED, #F9A8D4)" }}
          >
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Compare Providers</h1>
            <p className="text-gray-500 text-sm">Side-by-side comparison to help you choose</p>
          </div>
        </div>

        {providers.length < 2 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">⚖️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Select at least 2 providers to compare
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Browse our provider listing, then use the &quot;Compare&quot; button on each card to add them here.
            </p>
            <Link href="/search">
              <Button
                size="lg"
                className="rounded-2xl text-white font-semibold px-8"
                style={{ background: "#7C3AED" }}
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
                  <div key={p.id} className="bg-white rounded-t-2xl border border-gray-100 border-b-0 p-5 text-center relative mx-1">
                    <button
                      onClick={() => removeProvider(p.id)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-purple-50 mx-auto mb-3 border border-gray-100">
                      <Image src={p.image} alt={p.name} width={64} height={64} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">{p.name}</h3>
                    <Badge className="rounded-full bg-purple-100 text-purple-700 border-0 text-xs">
                      {categoryLabels[p.category]}
                    </Badge>
                  </div>
                ))}

                {/* Rows */}
                {[
                  {
                    label: "Location",
                    render: (p: typeof PROVIDERS[0]) => (
                      <span className="flex items-center gap-1 text-gray-700 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        {p.location}
                      </span>
                    ),
                  },
                  {
                    label: "Rating",
                    render: (p: typeof PROVIDERS[0]) => (
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="font-semibold text-gray-900">{p.rating}</span>
                        <span className="text-gray-400 text-xs">({p.reviewCount})</span>
                      </span>
                    ),
                  },
                  {
                    label: "Price",
                    render: (p: typeof PROVIDERS[0]) => (
                      <span className="font-bold text-gray-900">
                        P {p.price.toLocaleString()}{" "}
                        <span className="font-normal text-gray-400 text-xs">/{p.priceUnit}</span>
                      </span>
                    ),
                  },
                  {
                    label: "Verified",
                    render: (p: typeof PROVIDERS[0]) =>
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
                    render: (p: typeof PROVIDERS[0]) => (
                      <span className="text-gray-700 text-sm">{p.experience}</span>
                    ),
                  },
                  {
                    label: "Availability",
                    render: (p: typeof PROVIDERS[0]) => (
                      <span className="text-gray-700 text-sm">{p.availability}</span>
                    ),
                  },
                  {
                    label: "Services",
                    render: (p: typeof PROVIDERS[0]) => (
                      <div className="flex flex-wrap gap-1">
                        {p.services.slice(0, 3).map((s) => (
                          <span key={s} className="bg-purple-50 text-purple-700 rounded-full px-2 py-0.5 text-xs">
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
                  <>
                    <div
                      key={`label-${row.label}`}
                      className="bg-gray-50 border-y border-l border-gray-100 px-4 py-4 flex items-center font-semibold text-gray-700 text-sm"
                    >
                      {row.label}
                    </div>
                    {providers.map((p) => (
                      <div
                        key={`${p.id}-${row.label}`}
                        className="bg-white border-y border-r border-gray-100 px-5 py-4 flex items-center mx-1"
                      >
                        {row.render(p)}
                      </div>
                    ))}
                  </>
                ))}

                {/* Fees comparison (schools only) */}
                {providers.some((p) => p.fees) && (
                  <>
                    <div className="bg-purple-50 border-y border-l border-purple-100 px-4 py-4 flex items-center font-semibold text-purple-700 text-sm">
                      Fee Structure
                    </div>
                    {providers.map((p) => (
                      <div key={`fees-${p.id}`} className="bg-purple-50/30 border-y border-r border-purple-100 px-5 py-4 mx-1">
                        {p.fees ? (
                          <div className="text-xs space-y-1">
                            {p.fees.slice(0, 3).map((fee) => (
                              <div key={fee.grade} className="flex justify-between gap-2">
                                <span className="text-gray-600">{fee.grade}</span>
                                <span className="font-semibold text-gray-900">P {fee.termly.toLocaleString()}/term</span>
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
                  <div key={`action-${p.id}`} className="bg-white rounded-b-2xl border border-gray-100 border-t-0 p-4 mx-1">
                    <Link href={`/provider/${p.id}`}>
                      <Button className="w-full rounded-xl text-white text-sm font-semibold" style={{ background: "#7C3AED" }}>
                        View Profile
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Another */}
            {providers.length < 3 && (
              <div className="mt-6 text-center">
                <Link href="/search">
                  <Button variant="outline" className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-2 mx-auto">
                    <Plus className="w-4 h-4" />
                    Add Another Provider
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
