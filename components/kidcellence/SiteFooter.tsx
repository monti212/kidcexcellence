"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/kidcellence/routes";
import { Star } from "./Icon";

// Footer from the design, with the live site's links.
export function SiteFooter() {
  const pathname = usePathname();
  // The messages screen is a full-height app view.
  if (pathname === routes.messages) return null;

  return (
    <footer className="kc-foot" style={{ background: "#3f3e44", color: "#ffffff", marginTop: "auto" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 24px 40px", display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={26} color="#f05a3c" />
            <strong style={{ fontSize: 20 }}>Kidcellence</strong>
          </span>
          <p style={{ margin: 0, color: "rgba(255,255,255,.78)", fontSize: 14, lineHeight: 1.6, maxWidth: 300 }}>
            Childcare and children&apos;s services for Botswana. Discover, compare, message and verify trusted providers.
          </p>
        </div>
        <nav aria-label="Parents" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Parents</strong>
          <Link href={routes.browse}>Browse</Link>
          <Link href={routes.compare}>Compare</Link>
          <Link href={routes.messages}>Messages</Link>
          <Link href={routes.safety}>Safety</Link>
        </nav>
        <nav aria-label="Providers" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Providers</strong>
          <Link href={routes.providerSignup}>List your service</Link>
          <Link href={routes.pricing}>Pricing</Link>
          <Link href={routes.providerDashboard}>Get verified</Link>
        </nav>
        <nav aria-label="Kidcellence" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Kidcellence</strong>
          <Link href={routes.help}>Help</Link>
          <Link href={routes.terms}>Terms</Link>
          <Link href={routes.privacy}>Privacy</Link>
        </nav>
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px 32px", borderTop: "1px solid rgba(255,255,255,.18)", fontSize: 13, color: "rgba(255,255,255,.78)" }}>
        © 2026 Kidcellence · kidcellence.com
      </div>
    </footer>
  );
}
