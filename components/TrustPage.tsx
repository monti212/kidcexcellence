import type { ReactNode } from "react";
import Link from "next/link";
import { routes } from "@/lib/kidcellence/routes";

interface TrustSection {
  title: string;
  body?: string;
  items?: string[];
}

// Shared layout for the safety, privacy and terms pages, in the Kidcellence
// design language (ivory hero, white rounded panels, teal accents).
export function TrustPage({
  eyebrow,
  title,
  introduction,
  icon,
  sections,
  updated,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  icon: ReactNode;
  sections: TrustSection[];
  updated?: string;
}) {
  return (
    <div style={{ background: "#ffffff", color: "#3f3e44" }}>
      <section style={{ background: "#f4fbfc", overflow: "hidden" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 16px 56px", display: "flex", flexDirection: "column", gap: 20 }}>
          <Link href={routes.home} style={{ alignSelf: "flex-start", fontSize: 14, fontWeight: 700, color: "#2a7b86" }}>
            ← Back to Kidcellence
          </Link>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
            <span
              aria-hidden="true"
              style={{ flex: "0 0 auto", width: 56, height: 56, borderRadius: "50%", background: "#54b2bf", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {icon}
            </span>
            <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ alignSelf: "flex-start", background: "#fff5d3", color: "#3f3e44", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 999, letterSpacing: ".4px", textTransform: "uppercase" }}>
                {eyebrow}
              </span>
              <h1 style={{ margin: 0, fontSize: "clamp(34px, 6vw, 52px)", lineHeight: 1.08, fontWeight: 800, letterSpacing: "-1.5px" }}>
                {title}
              </h1>
              <p style={{ margin: 0, maxWidth: 720, fontSize: 18, lineHeight: 1.6, color: "#686973" }}>{introduction}</p>
              {updated && (
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#686973" }}>Last updated {updated}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 16px 80px", display: "flex", flexDirection: "column", gap: 16 }}>
        {sections.map((section) => (
          <section
            key={section.title}
            className="kc-panel"
            style={{ padding: 24, display: "flex", flexWrap: "wrap", gap: "12px 40px" }}
          >
            <h2 style={{ flex: "1 1 200px", margin: 0, fontSize: 20, fontWeight: 800 }}>{section.title}</h2>
            <div style={{ flex: "999 1 420px", minWidth: 0, fontSize: 16, lineHeight: 1.7, color: "#686973" }}>
              {section.body && <p style={{ margin: 0 }}>{section.body}</p>}
              {section.items && (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {section.items.map((item) => (
                    <li key={item} style={{ display: "flex", gap: 12 }}>
                      <span aria-hidden="true" style={{ flex: "0 0 auto", marginTop: 10, width: 8, height: 8, borderRadius: "50%", background: "#54b2bf" }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}

        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href={routes.help} className="kc-btn">Visit help centre</Link>
          <Link href={routes.browse} className="kc-btn-outline">Browse providers</Link>
        </div>
      </div>
    </div>
  );
}
