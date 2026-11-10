"use client";

import Link from "next/link";
import { Icon } from "@/components/kidcellence/Icon";
import { routes } from "@/lib/kidcellence/routes";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

const MAX_COMPARE = 3;

// Adds this provider to the same compare list that /search and /compare use
// ("kidcellence.compareIds" in localStorage, at most three providers).
export function CompareToggle({ providerId }: { providerId: string }) {
  const [compareIds, setCompareIds] = useLocalStorageState<string[]>(
    "kidcellence.compareIds",
    [],
    (value): value is string[] => Array.isArray(value)
  );
  const inCompare = compareIds.includes(providerId);
  const full = !inCompare && compareIds.length >= MAX_COMPARE;

  const toggle = () =>
    setCompareIds((prev) =>
      prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : prev.length < MAX_COMPARE
          ? [...prev, providerId]
          : prev
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        aria-pressed={inCompare}
        disabled={full}
        onClick={toggle}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, minHeight: 44, borderRadius: 14, border: `1px solid ${inCompare ? "#54b2bf" : "#d7edf0"}`, background: inCompare ? "#f4fbfc" : "#ffffff", color: "#3f3e44", fontWeight: 700, fontSize: 14, opacity: full ? 0.6 : 1, cursor: full ? "not-allowed" : "pointer" }}
      >
        <Icon name="compare" size={18} color="#2a7b86" />
        {inCompare ? "In compare" : "Compare"}
      </button>
      {full && <span style={{ fontSize: 13, color: "#686973" }}>You can compare up to three providers. Remove one first.</span>}
      {compareIds.length > 0 && (
        <Link href={routes.compare} style={{ fontSize: 14, fontWeight: 700, color: "#2a7b86" }}>
          View compare ({compareIds.length})
        </Link>
      )}
    </div>
  );
}
