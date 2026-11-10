"use client";

import { Fragment, Suspense, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/kidcellence/Icon";
import type { Provider } from "@/lib/mock-data";
import { getCategoryLabel } from "@/lib/platform-service";
import {
  formatPrice,
  initialsOf,
  providerPhoto,
  providerTint,
} from "@/lib/kidcellence/provider-display";
import { routes } from "@/lib/kidcellence/routes";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

type Row = {
  label: string;
  /** Plain text used for "show differences only". */
  value: (p: Provider) => string;
  render?: (p: Provider) => ReactNode;
};

const STAY_LABELS: Record<string, string> = { "stay-in": "Live-in", "stay-out": "Live-out" };

const TRUST_ROWS: Row[] = [
  {
    label: "Kidcellence verification",
    value: (p) => (p.verified ? "Verified" : "Not verified"),
    render: (p) =>
      p.verified ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2a7b86", fontWeight: 800 }}>
          <Icon name="check" size={16} color="#2a7b86" strokeWidth={2.6} />
          Verified
        </span>
      ) : (
        <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 999, border: "1px solid #d7edf0", background: "#f4fbfc", color: "#686973", fontWeight: 800, fontSize: 13 }}>
          Not verified
        </span>
      ),
  },
  {
    label: "Rating",
    value: (p) => (p.reviewCount ? `${p.rating} (${p.reviewCount})` : "No reviews yet"),
    render: (p) =>
      p.reviewCount ? (
        <span>
          <strong>{p.rating}</strong> <span style={{ color: "#686973", fontSize: 13 }}>({p.reviewCount} reviews)</span>
        </span>
      ) : (
        <span style={{ color: "#686973" }}>No reviews yet</span>
      ),
  },
];

const DETAIL_ROWS: Row[] = [
  { label: "Category", value: (p) => getCategoryLabel(p.category) },
  { label: "Price", value: (p) => formatPrice(p) },
  { label: "Experience", value: (p) => p.experience || "" },
  { label: "Availability", value: (p) => p.availability || "" },
  { label: "Arrangement", value: (p) => (p.stayArrangement ? STAY_LABELS[p.stayArrangement] ?? p.stayArrangement : "") },
  { label: "Ages", value: (p) => p.careAges || "" },
  { label: "Languages", value: (p) => (p.languages ?? []).join(", ") },
  {
    label: "Services",
    value: (p) => p.services.join(", "),
    render: (p) =>
      p.services.length ? (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {p.services.slice(0, 3).map((service) => (
            <span key={service} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "#f4fbfc", border: "1px solid #d7edf0" }}>{service}</span>
          ))}
          {p.services.length > 3 && <span style={{ fontSize: 12, color: "#686973" }}>+{p.services.length - 3} more</span>}
        </span>
      ) : null,
  },
  {
    label: "Fee structure",
    value: (p) => (p.fees ?? []).map((fee) => `${fee.grade}:${fee.termly}`).join("|"),
    render: (p) =>
      p.fees?.length ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          {p.fees.slice(0, 3).map((fee) => (
            <span key={fee.grade} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#686973" }}>{fee.grade}</span>
              <strong>P{fee.termly.toLocaleString()}/term</strong>
            </span>
          ))}
        </span>
      ) : null,
  },
];

const labelCell: CSSProperties = { padding: "16px 20px", fontWeight: 700 };
const cell: CSSProperties = { padding: "16px 20px", borderLeft: "1px solid #d7edf0", minWidth: 0, overflowWrap: "anywhere" };

function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryIds = searchParams.get("ids");
  const [storedCompareIds, setCompareIds] = useLocalStorageState<string[]>(
    "kidcellence.compareIds",
    [],
    (value): value is string[] =>
      Array.isArray(value) &&
      value.length <= 3 &&
      value.every((item) => typeof item === "string")
  );
  const compareIds = useMemo(() => storedCompareIds.slice(0, 3), [storedCompareIds]);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [differencesOnly, setDifferencesOnly] = useState(false);

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

  // Rows where every provider is blank are hidden; "differences only" also hides
  // rows where every provider has the same value.
  const visible = (row: Row) => {
    const values = providers.map((p) => row.value(p).trim());
    if (values.every((value) => !value)) return false;
    return !differencesOnly || new Set(values).size > 1;
  };

  const columns = `minmax(150px, 1fr) repeat(${Math.max(providers.length, 1)}, minmax(200px, 1.4fr))`;
  const rowStyle: CSSProperties = { display: "grid", gridTemplateColumns: columns, borderTop: "1px solid #d7edf0" };

  const renderRows = (rows: Row[]) =>
    rows.filter(visible).map((row) => (
      <div key={row.label} style={rowStyle}>
        <div style={labelCell}>{row.label}</div>
        {providers.map((p) => (
          <div key={p.id} style={cell}>
            {row.render ? row.render(p) ?? <span style={{ color: "#686973" }}>Not listed</span> : row.value(p) || <span style={{ color: "#686973" }}>Not listed</span>}
          </div>
        ))}
      </div>
    ));

  const trustRows = renderRows(TRUST_ROWS);
  const detailRows = renderRows(DETAIL_ROWS);

  return (
    <div style={{ color: "#3f3e44", background: "#f4fbfc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 16px 96px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ alignSelf: "flex-start", background: "#ffffff", color: "#2a7b86", border: "1px solid #d7edf0", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999, letterSpacing: ".4px" }}>
              SIDE-BY-SIDE DECISIONS
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-1px" }}>
              {providers.length >= 2 ? `Compare ${providers.length} providers` : "Compare providers"}
            </h1>
          </div>
          {providers.length >= 2 && (
            <button
              type="button"
              aria-pressed={differencesOnly}
              onClick={() => setDifferencesOnly((value) => !value)}
              style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "0 20px", borderRadius: 999, border: "2px solid #2a7b86", background: differencesOnly ? "#2a7b86" : "#ffffff", color: differencesOnly ? "#ffffff" : "#2a7b86", fontWeight: 800, fontSize: 15 }}
            >
              {differencesOnly ? "Showing differences only" : "Show differences only"}
            </button>
          )}
        </div>

        {providers.length < 2 ? (
          <div style={{ background: "#ffffff", borderRadius: 24, padding: "56px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", boxShadow: "0 6px 20px rgba(63,62,68,.06)" }}>
            <span style={{ width: 72, height: 72, borderRadius: "50%", background: "#f4fbfc", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="compare" size={32} color="#2a7b86" />
            </span>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Select at least 2 providers to compare</h2>
            <p style={{ margin: 0, color: "#686973", maxWidth: 440, lineHeight: 1.6 }}>
              Browse the provider listing, then tick &quot;Compare&quot; on up to three cards to see them side by side here.
            </p>
            <Link href={routes.browse} className="kc-btn" style={{ marginTop: 8 }}>Browse providers</Link>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto", borderRadius: 24, background: "#ffffff", boxShadow: "0 6px 20px rgba(63,62,68,.06)" }}>
              <div style={{ minWidth: 150 + providers.length * 200, fontSize: 15 }}>
                <div style={{ display: "grid", gridTemplateColumns: columns }}>
                  <div style={{ padding: 20, display: "flex", alignItems: "flex-end", fontSize: 12, fontWeight: 800, color: "#686973", textTransform: "uppercase", letterSpacing: ".6px" }}>
                    Provider
                  </div>
                  {providers.map((p) => {
                    const photo = providerPhoto(p);
                    return (
                      <div key={p.id} style={{ padding: 20, borderLeft: "1px solid #d7edf0", display: "flex", flexDirection: "column", gap: 10, position: "relative", minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => removeProvider(p.id)}
                          aria-label={`Remove ${p.name} from comparison`}
                          style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: "50%", border: "1px solid #d7edf0", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Icon name="x" size={14} color="#3f3e44" strokeWidth={2.4} />
                        </button>
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served by our own API route
                          <img src={photo} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: "50%", background: providerTint(p.id), color: "#3f3e44", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22 }}>
                            {initialsOf(p.name)}
                          </span>
                        )}
                        <Link href={routes.provider(p.id)} style={{ fontWeight: 800, fontSize: 19, color: "#3f3e44", textDecoration: "none", paddingRight: 36, overflowWrap: "anywhere" }}>
                          {p.name}
                        </Link>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#686973", fontSize: 14 }}>
                          <Icon name="pin" size={15} color="#686973" />
                          {p.location || "Botswana"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {trustRows.length > 0 && (
                  <Fragment>
                    <h2 style={{ margin: 0, padding: "12px 20px", background: "#54b2bf", color: "#3f3e44", fontSize: 16, fontWeight: 800 }}>Trust record</h2>
                    {trustRows}
                  </Fragment>
                )}

                {detailRows.length > 0 && (
                  <Fragment>
                    <h2 style={{ margin: 0, padding: "12px 20px", background: "#fff5d3", fontSize: 16, fontWeight: 800, borderTop: "1px solid #d7edf0" }}>Care details</h2>
                    {detailRows}
                  </Fragment>
                )}

                {differencesOnly && trustRows.length === 0 && detailRows.length === 0 && (
                  <p style={{ margin: 0, padding: "16px 20px", borderTop: "1px solid #d7edf0", color: "#686973" }}>
                    These providers list the same details.
                  </p>
                )}

                <div style={{ ...rowStyle, background: "#f4fbfc" }}>
                  <div />
                  {providers.map((p) => (
                    <div key={p.id} style={{ padding: "20px", borderLeft: "1px solid #d7edf0", display: "flex", flexDirection: "column", gap: 8 }}>
                      <Link href={`${routes.messages}?provider=${encodeURIComponent(p.id)}`} style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 46, borderRadius: 14, background: "#2a7b86", color: "#ffffff", textDecoration: "none", fontWeight: 800 }}>
                        Message
                      </Link>
                      <Link href={routes.provider(p.id)} style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 44, borderRadius: 14, border: "2px solid #2a7b86", background: "#ffffff", color: "#2a7b86", textDecoration: "none", fontWeight: 800 }}>
                        View profile
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}>
              {providers.length < 3 && (
                <Link href={routes.browse} className="kc-btn-outline">
                  <Icon name="plus" size={18} />
                  Add another provider
                </Link>
              )}
              <button type="button" className="kc-btn-outline" style={{ borderColor: "#d7edf0", color: "#686973" }} onClick={() => setCompareIds([])}>
                <Icon name="trash" size={18} />
                Clear comparison
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#686973", textAlign: "center" }}>
              Compare up to 3 providers. Verification follows each category&apos;s own document checklist.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", padding: 32, color: "#686973", background: "#f4fbfc" }}>Loading comparison...</div>}>
      <ComparePageContent />
    </Suspense>
  );
}
