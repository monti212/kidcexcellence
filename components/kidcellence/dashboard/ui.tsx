import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/kidcellence/Icon";

// Presentation primitives for the provider dashboard, in the design's visual
// language (components/kidcellence/screens/ProviderDashboardScreen.tsx).

export const panelStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 24,
  padding: 26,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  boxShadow: "0 6px 20px rgba(63,62,68,.06)",
  minWidth: 0,
};

export function Panel({
  id,
  title,
  description,
  action,
  children,
  style,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section id={id} style={{ ...panelStyle, ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            {title && <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{title}</h2>}
            {description && <p style={{ margin: "4px 0 0", fontSize: 14, color: "#686973", lineHeight: 1.5 }}>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label wrapping its control, so every field is programmatically labelled. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#3f3e44" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 12, color: "#686973" }}>{hint}</span>}
    </label>
  );
}

/** Category-specific group of fields, on the soft ivory tint. */
export function FieldGroup({ children, className, onChange }: { children: ReactNode; className?: string; onChange?: () => void }) {
  return (
    <div
      onChange={onChange}
      className={className}
      style={{ display: "grid", gap: 16, padding: 18, borderRadius: 18, background: "#f4fbfc", border: "1px solid #d7edf0" }}
    >
      {children}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", borderRadius: 16, background: "#ffffff", border: "1px solid #d7edf0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
        {description && <div style={{ fontSize: 13, color: "#686973" }}>{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        style={{ flex: "0 0 auto", width: 52, height: 30, borderRadius: 999, border: 0, padding: 3, background: checked ? "#2a7b86" : "#d7edf0", display: "flex", justifyContent: checked ? "flex-end" : "flex-start", transition: "background .15s ease" }}
      >
        <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
      </button>
    </div>
  );
}

export function StatTile({
  icon,
  label,
  value,
  detail,
  warm = false,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  warm?: boolean;
}) {
  return (
    <div style={{ background: warm ? "#fff5d3" : "#ffffff", borderRadius: 22, padding: 22, display: "flex", flexDirection: "column", gap: 6, boxShadow: warm ? undefined : "0 6px 20px rgba(63,62,68,.06)", minWidth: 0 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#686973" }}>
        <Icon name={icon} size={16} color={warm ? "#3f3e44" : "#2a7b86"} />
        {label}
      </span>
      <strong style={{ fontSize: 36, letterSpacing: "-1px", lineHeight: 1.1 }}>{value}</strong>
      {detail && <span style={{ fontSize: 13, color: "#686973", fontWeight: 600 }}>{detail}</span>}
    </div>
  );
}

/** Status line under a form or upload area. */
export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      role="status"
      style={{
        borderRadius: 16,
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 700,
        background: tone === "warn" ? "#fff5d3" : "#f4fbfc",
        color: tone === "warn" ? "#c2412a" : "#2a7b86",
        border: `1px solid ${tone === "warn" ? "#ffcc2f" : "#d7edf0"}`,
      }}
    >
      {children}
    </div>
  );
}

/** Hidden file input styled as one of the design's upload buttons. */
export function UploadButton({
  label,
  accept,
  disabled,
  onFile,
  variant = "solid",
  ariaLabel,
}: {
  label: string;
  accept: string;
  disabled?: boolean;
  onFile: (file: File | undefined) => void;
  variant?: "solid" | "outline";
  ariaLabel?: string;
}) {
  const solid = variant === "solid";
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 800,
        fontSize: 14,
        padding: "10px 16px",
        minHeight: 44,
        borderRadius: 12,
        border: solid ? 0 : "1px solid #d7edf0",
        background: solid ? "#2a7b86" : "#ffffff",
        color: solid ? "#ffffff" : "#2a7b86",
        cursor: disabled ? "not-allowed" : "pointer",
        flex: "0 0 auto",
      }}
    >
      <input
        type="file"
        className="kc-sr-only"
        accept={accept}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Icon name="upload" size={18} color={solid ? "#ffffff" : "#2a7b86"} strokeWidth={2.2} />
      {label}
    </label>
  );
}

/** One row of the verification checklist (design: dashed when missing, ticked when uploaded). */
export function DocumentRow({
  index,
  label,
  hint,
  fileName,
  sensitive,
  disabled,
  onFile,
  onRemove,
}: {
  index: number;
  label: string;
  hint: string;
  fileName?: string;
  sensitive: boolean;
  disabled?: boolean;
  onFile: (file: File | undefined) => void;
  onRemove?: () => void;
}) {
  const done = Boolean(fileName);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 14,
        borderRadius: 18,
        background: done ? "#f4fbfc" : "#ffffff",
        border: `2px ${done ? "solid" : "dashed"} ${done ? "#f4fbfc" : "#54b2bf"}`,
        flexWrap: "wrap",
      }}
    >
      {done ? (
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#2a7b86", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
          <Icon name="check" size={20} color="#ffffff" strokeWidth={2.6} />
        </span>
      ) : (
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#ffffff", border: "2px solid #d7edf0", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", fontWeight: 800, color: "#686973" }}>
          {index + 1}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 2 }}>
        <strong style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {label}
          {sensitive && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, color: "#c2412a", background: "#fff5d3", padding: "3px 8px", borderRadius: 999 }}>
              <Icon name="lock" size={12} color="#c2412a" strokeWidth={2.4} />
              Admin review only
            </span>
          )}
        </strong>
        <span style={{ fontSize: 13, color: "#686973", overflowWrap: "anywhere" }}>
          {done ? `${fileName}${sensitive ? " · visible to admin only" : " · uploaded"}` : hint}
        </span>
      </span>
      {done && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          style={{ background: "none", border: 0, minHeight: 44, padding: "0 6px", fontWeight: 700, fontSize: 14, color: "#2a7b86", textDecoration: "underline" }}
        >
          Remove
        </button>
      )}
      <UploadButton
        label={done ? "Replace" : "Upload"}
        ariaLabel={`${done ? "Replace" : "Upload"} ${label}`}
        variant={done ? "outline" : "solid"}
        accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
        disabled={disabled}
        onFile={onFile}
      />
    </div>
  );
}
