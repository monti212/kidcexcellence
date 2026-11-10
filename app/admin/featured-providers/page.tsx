"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, Star } from "@/components/kidcellence/Icon";
import {
  AdminBand,
  Avatar,
  KpiCard,
  Notice,
  Pill,
  panelStyle,
} from "@/components/kidcellence/admin/AdminUi";
import { routes } from "@/lib/kidcellence/routes";
import { getCategoryLabel } from "@/lib/platform-service";
import { usePlatformSession } from "@/lib/use-platform-session";

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

function FeaturedProvidersAdmin() {
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
    <div style={{ color: "#3f3e44", background: "#f4fbfc", minHeight: "100vh" }}>
      <AdminBand
        title="Featured Providers"
        subtitle={`${featuredCount} featured`}
        right={
          <Link
            href={routes.admin}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", minHeight: 44, borderRadius: 999, background: "rgba(255,255,255,.18)", color: "#ffffff", fontWeight: 800, textDecoration: "none" }}
          >
            Back to verification desk
          </Link>
        }
      />

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px 64px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Notice tone="warning">
          Featured selections are held in server memory only. They reset whenever the server restarts or redeploys, and may differ between server instances, so they do not yet change what parents see.
        </Notice>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
          <KpiCard label="Total providers" value={String(providers.length)} />
          <KpiCard label="Verified" value={String(verifiedCount)} />
          <KpiCard warm label="Featured" value={String(featuredCount)} />
        </div>

        {message && (
          <Notice tone={message.startsWith("Error") ? "error" : "success"}>{message}</Notice>
        )}

        <section style={panelStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderRadius: 999, border: "1px solid #d7edf0", background: "#ffffff", flex: "1 1 260px", minWidth: 0 }}>
              <Icon name="search" size={18} color="#686973" />
              <span className="kc-sr-only">Search providers</span>
              <input
                type="text"
                placeholder="Search by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 0, outline: 0, background: "transparent", minHeight: 44, flex: 1, minWidth: 0, fontSize: 14, color: "#3f3e44" }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={promoteProviders}
                disabled={selectedProviders.size === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "10px 18px", borderRadius: 999, border: 0, fontWeight: 800, background: selectedProviders.size === 0 ? "#f4fbfc" : "#ffcc2f", color: selectedProviders.size === 0 ? "#686973" : "#3f3e44", cursor: selectedProviders.size === 0 ? "not-allowed" : "pointer" }}
              >
                <Star size={16} color={selectedProviders.size === 0 ? "#9fb9bd" : "#3f3e44"} />
                Promote ({selectedProviders.size})
              </button>
              <button
                type="button"
                onClick={demoteProviders}
                disabled={selectedProviders.size === 0}
                className="kc-btn-outline"
                style={{ padding: "10px 18px" }}
              >
                <Icon name="x" size={16} />
                Demote
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ margin: "24px 0", textAlign: "center", color: "#686973" }}>Loading providers...</p>
          ) : filteredProviders.length === 0 ? (
            <p style={{ margin: "24px 0", textAlign: "center", color: "#686973" }}>No providers found</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
              {filteredProviders.map((provider) => {
                const selected = selectedProviders.has(provider.id);
                return (
                  <label
                    key={provider.id}
                    style={{ border: `2px solid ${provider.featured ? "#ffcc2f" : selected ? "#54b2bf" : "#d7edf0"}`, borderRadius: 20, padding: 16, display: "flex", alignItems: "center", gap: 12, background: provider.featured ? "#fff5d3" : "#ffffff", cursor: "pointer", minWidth: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleProvider(provider.id)}
                      aria-label={`Select ${provider.name}`}
                      style={{ width: 20, height: 20, accentColor: "#2a7b86", flex: "0 0 auto" }}
                    />
                    <Avatar id={provider.id} name={provider.name} size={44} />
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      <strong style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis" }}>{provider.name}</strong>
                      <span style={{ fontSize: 13, color: "#686973" }}>
                        {getCategoryLabel(provider.category)} · Rating: {provider.rating || "New"}
                      </span>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {provider.verified && <Pill tone="approved">Verified</Pill>}
                        {provider.featured && <Pill tone="rejected">Featured</Pill>}
                      </span>
                      {provider.promotionExpiresAt && (
                        <span style={{ fontSize: 12, color: "#686973" }}>
                          Expires: {new Date(provider.promotionExpiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function FeaturedProvidersPage() {
  const { user, loading } = usePlatformSession();

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#686973", background: "#f4fbfc" }}>
        Checking admin session...
      </div>
    );
  }

  // The API route enforces admin access; this only avoids showing admin
  // controls to people who cannot use them.
  if (user?.role !== "admin") {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", background: "#f4fbfc" }}>
        <div style={{ maxWidth: 420, background: "#ffffff", borderRadius: 24, padding: 32, border: "1px solid #d7edf0", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <Icon name="lock" size={36} color="#2a7b86" />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Admin access required</h1>
          <p style={{ margin: 0, color: "#686973", fontSize: 14 }}>Sign in with an admin account to manage featured providers.</p>
          <Link href={routes.admin} className="kc-btn">Go to admin sign-in</Link>
        </div>
      </div>
    );
  }

  return <FeaturedProvidersAdmin />;
}
