"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Star,
  Trash2,
  Check,
  TrendingUp,
} from "lucide-react";

interface FeaturedProvider {
  id: string;
  name: string;
  category: string;
  rating: number;
  verified: boolean;
  featured: boolean;
  promotionExpiresAt?: string;
  fee?: number;
}

export default function FeaturedProvidersAdmin() {
  const [providers, setProviders] = useState<FeaturedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set()
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/featured-providers", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load providers");
      const data = await response.json();
      setProviders(data.providers || []);
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Failed to load"}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = (id: string) => {
    const newSelected = new Set(selectedProviders);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProviders(newSelected);
  };

  const promoteProviders = async () => {
    if (selectedProviders.size === 0) {
      setMessage("Please select providers to promote");
      return;
    }

    try {
      const response = await fetch("/api/admin/featured-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promote",
          providerIds: Array.from(selectedProviders),
        }),
      });

      if (!response.ok) throw new Error("Failed to promote providers");
      const data = await response.json();
      setMessage(data.message || "Providers promoted successfully");
      setSelectedProviders(new Set());
      await loadProviders();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Failed to promote"}`);
    }
  };

  const demoteProviders = async () => {
    if (selectedProviders.size === 0) {
      setMessage("Please select providers to demote");
      return;
    }

    try {
      const response = await fetch("/api/admin/featured-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "demote",
          providerIds: Array.from(selectedProviders),
        }),
      });

      if (!response.ok) throw new Error("Failed to demote providers");
      const data = await response.json();
      setMessage(data.message || "Providers demoted successfully");
      setSelectedProviders(new Set());
      await loadProviders();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Failed to demote"}`);
    }
  };

  const filteredProviders = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredCount = providers.filter((p) => p.featured).length;
  const verifiedCount = providers.filter((p) => p.verified).length;

  return (
    <div className="brand-page">
      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="rounded-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-black text-[var(--brand-ink)]">
              Featured Providers
            </h1>
          </div>
          <Badge className="bg-[var(--brand-sky)] text-white">
            {featuredCount} featured
          </Badge>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-3">
          {[
            ["Total Providers", String(providers.length)],
            ["Verified", String(verifiedCount)],
            ["Featured", String(featuredCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--brand-line)] bg-white p-3"
            >
              <div className="text-xs font-bold uppercase text-[var(--brand-muted)]">
                {label}
              </div>
              <div className="text-2xl font-black text-[var(--brand-ink)]">
                {value}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 ${
              message.startsWith("Error")
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-green-200 bg-green-50 text-green-900"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            type="text"
            placeholder="Search by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-full border-[var(--brand-line)] bg-[var(--brand-paper)]"
          />
          <div className="flex gap-2">
            <Button
              onClick={promoteProviders}
              disabled={selectedProviders.size === 0}
              className="rounded-full bg-[var(--brand-sky)] px-4 font-black text-white hover:bg-[var(--brand-coral)]"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Promote ({selectedProviders.size})
            </Button>
            <Button
              onClick={demoteProviders}
              variant="outline"
              disabled={selectedProviders.size === 0}
              className="rounded-full border-[var(--brand-line)]"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Demote
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-[var(--brand-muted)]">
            Loading providers...
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center text-[var(--brand-muted)]">
            No providers found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center gap-4 rounded-lg border border-[var(--brand-line)] p-4"
              >
                <input
                  type="checkbox"
                  checked={selectedProviders.has(provider.id)}
                  onChange={() => toggleProvider(provider.id)}
                  className="h-5 w-5 rounded border-[var(--brand-line)]"
                />
                <div className="flex-1">
                  <div className="font-black text-[var(--brand-ink)]">
                    {provider.name}
                  </div>
                  <div className="text-sm text-[var(--brand-muted)]">
                    {provider.category} • Rating: {provider.rating}
                  </div>
                </div>
                <div className="flex gap-2">
                  {provider.verified && (
                    <Badge className="bg-green-100 text-green-900">
                      <Check className="mr-1 h-3 w-3" /> Verified
                    </Badge>
                  )}
                  {provider.featured && (
                    <Badge className="bg-yellow-100 text-yellow-900">
                      <Star className="mr-1 h-3 w-3" /> Featured
                    </Badge>
                  )}
                </div>
                {provider.promotionExpiresAt && (
                  <div className="text-xs text-[var(--brand-muted)]">
                    Expires: {new Date(provider.promotionExpiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
