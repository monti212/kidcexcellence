import type { CSSProperties, ReactNode } from "react";
import { initialsOf, providerTint } from "@/lib/kidcellence/provider-display";

// Shared pieces of the design's admin verification desk.

export const cardShadow = "0 6px 20px rgba(63,62,68,.06)";

export const panelStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 24,
  padding: 22,
  boxShadow: cardShadow,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  minWidth: 0,
};

export const linkButton: CSSProperties = {
  color: "#2a7b86",
  background: "none",
  border: 0,
  cursor: "pointer",
  textDecoration: "underline",
  fontWeight: 800,
  fontSize: 14,
  minHeight: 40,
  padding: "0 6px",
};

export type PillTone = "pending" | "approved" | "rejected" | "neutral" | "warning";

const PILL_COLORS: Record<PillTone, [string, string]> = {
  pending: ["#f4fbfc", "#2a7b86"],
  approved: ["#2a7b86", "#ffffff"],
  rejected: ["#fff5d3", "#3f3e44"],
  neutral: ["#f4fbfc", "#686973"],
  warning: ["#fff5d3", "#c2412a"],
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const [background, color] = PILL_COLORS[tone];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 800,
        padding: "4px 10px",
        borderRadius: 999,
        background,
        color,
        whiteSpace: "nowrap",
        border: tone === "pending" || tone === "neutral" ? "1px solid #d7edf0" : undefined,
      }}
    >
      {children}
    </span>
  );
}

export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size > 40 ? 16 : 13,
        background: providerTint(id),
        color: "#3f3e44",
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  note,
  warm = false,
  children,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  warm?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        background: warm ? "#fff5d3" : "#ffffff",
        borderRadius: 22,
        padding: 22,
        boxShadow: warm ? undefined : cardShadow,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: "#686973" }}>{label}</span>
      <strong style={{ fontSize: 36, letterSpacing: "-1px", lineHeight: 1.1 }}>{value}</strong>
      {note && <span style={{ fontSize: 13, color: "#686973" }}>{note}</span>}
      {children}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "warning" | "success"; children: ReactNode }) {
  const styles: Record<typeof tone, CSSProperties> = {
    error: { background: "#fff5d3", color: "#c2412a", border: "1px solid #f3c9bd" },
    warning: { background: "#fff5d3", color: "#3f3e44", border: "1px solid #f5e3a3" },
    success: { background: "#f4fbfc", color: "#2a7b86", border: "1px solid #d7edf0" },
  };
  return (
    <div
      role={tone === "success" ? "status" : "alert"}
      style={{ ...styles[tone], borderRadius: 16, padding: "12px 16px", fontSize: 14, fontWeight: 700 }}
    >
      {children}
    </div>
  );
}

/** The teal gradient band at the top of the admin screens (the site header sits above it). */
export function AdminBand({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div style={{ background: "linear-gradient(120deg, #54b2bf 0%, #2a7b86 100%)", color: "#ffffff" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "22px 24px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px 16px", flexWrap: "wrap", paddingBottom: children ? 0 : 22 }}>
          <span style={{ background: "rgba(255,255,255,.2)", padding: "5px 12px", borderRadius: 999, fontSize: 13, fontWeight: 800 }}>Admin</span>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#ffffff" }}>{title}</h1>
            {subtitle && <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.9 }}>{subtitle}</span>}
          </div>
          <span style={{ flex: 1 }} />
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}
