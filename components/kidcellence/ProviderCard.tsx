import Link from "next/link";
import type { Provider } from "@/lib/mock-data";
import { routes } from "@/lib/kidcellence/routes";
import {
  formatPrice,
  initialsOf,
  providerBadgeLine,
  providerPhoto,
  providerTint,
} from "@/lib/kidcellence/provider-display";
import { Icon } from "./Icon";

type Props = {
  provider: Provider;
  /** Shows the Compare checkbox when provided. */
  onToggleCompare?: (id: string) => void;
  inCompare?: boolean;
  compareDisabled?: boolean;
  headingLevel?: "h2" | "h3";
};

// Listing card from the design's Browse and Home screens, bound to a real
// provider record: photo or initials on the dotted tint, verified line, services,
// town, price, Compare checkbox and View link to /provider/[id].
export function ProviderCard({
  provider: p,
  onToggleCompare,
  inCompare = false,
  compareDisabled = false,
  headingLevel: Heading = "h3",
}: Props) {
  const photo = providerPhoto(p);
  const href = routes.provider(p.id);
  return (
    <article
      className="kc-card"
      style={{ background: "#ffffff", borderRadius: 24, overflow: "hidden", boxShadow: "0 6px 20px rgba(63,62,68,.07)", display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      <div
        className="kc-dots"
        style={{ height: 170, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: providerTint(p.id) }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served by our own API route
          <img src={photo} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "4px solid #ffffff", boxShadow: "0 8px 20px rgba(63,62,68,.12)" }} />
        ) : (
          <span aria-hidden="true" style={{ width: 84, height: 84, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 26, color: "#2a7b86", boxShadow: "0 8px 20px rgba(63,62,68,.12)" }}>
            {initialsOf(p.name)}
          </span>
        )}
        {p.featured && (
          <span style={{ position: "absolute", top: 14, left: 14, background: "#ffcc2f", color: "#3f3e44", fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999 }}>Featured</span>
        )}
      </div>
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: p.verified ? "#2a7b86" : "#686973" }}>
          {p.verified && <Icon name="shieldCheck" size={16} color="#2a7b86" strokeWidth={2.2} />}
          {providerBadgeLine(p)}
        </div>
        <Heading style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>
          <Link href={href} style={{ color: "#3f3e44", textDecoration: "none" }}>{p.name}</Link>
        </Heading>
        {p.bio && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#686973", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.bio}</p>
        )}
        {p.services.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.services.slice(0, 2).map((service, index) => (
              <span
                key={service}
                style={index === 0
                  ? { fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "#f4fbfc", color: "#3f3e44", border: "1px solid #d7edf0" }
                  : { fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "#fff5d3", color: "#3f3e44" }}
              >
                {service}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14, color: "#686973", marginTop: "auto", paddingTop: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Icon name="pin" size={16} color="#686973" strokeWidth={2} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.location || "Botswana"}</span>
          </span>
          <strong style={{ color: "#3f3e44", fontSize: 13, whiteSpace: "nowrap" }}>{formatPrice(p)}</strong>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 6, borderTop: "1px solid #d7edf0", marginTop: 4 }}>
          {onToggleCompare ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, flex: 1, minHeight: 44, cursor: compareDisabled && !inCompare ? "not-allowed" : "pointer" }}>
              <input
                type="checkbox"
                checked={inCompare}
                disabled={compareDisabled && !inCompare}
                onChange={() => onToggleCompare(p.id)}
                style={{ width: 18, height: 18, accentColor: "#2a7b86" }}
              />
              Compare
            </label>
          ) : (
            <span style={{ flex: 1 }} />
          )}
          <Link href={href} aria-label={`View ${p.name}`} style={{ padding: "10px 16px", borderRadius: 12, background: "#2a7b86", color: "#ffffff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>View</Link>
        </div>
      </div>
    </article>
  );
}
