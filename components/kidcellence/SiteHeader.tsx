"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { routes } from "@/lib/kidcellence/routes";
import { initialsOf } from "@/lib/kidcellence/provider-display";
import { notifyPlatformSessionChanged, usePlatformSession } from "@/lib/use-platform-session";
import { Icon } from "./Icon";

const NAV = [
  { href: routes.browse, label: "Browse" },
  { href: routes.compare, label: "Compare" },
  { href: routes.pricing, label: "Pricing" },
  { href: routes.messages, label: "Messages" },
  { href: routes.safety, label: "Safety" },
  { href: routes.help, label: "Help" },
];

const roleBase = { display: "flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 999, fontSize: 14, border: 0 } as const;
const roleOn = { ...roleBase, background: "#2a7b86", color: "#ffffff", fontWeight: 800 } as const;
const roleOff = { ...roleBase, background: "transparent", color: "#3f3e44", fontWeight: 700 } as const;

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Site header from the design (signed-out and signed-in variants), bound to the
// real session. Admin links only render for admin sessions; the /admin page and
// its API routes enforce access independently of this.
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, loading, logout } = usePlatformSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");

  useEffect(() => {
    // Close the phone menu after navigation.
    const timer = window.setTimeout(() => setMenuOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const isAdmin = user?.role === "admin";
  const heldRoles = user?.roles ?? (user ? [user.role] : []);
  const canSwitchDirectly = !isAdmin && heldRoles.includes("parent") && heldRoles.includes("provider");
  const homeHref = user?.role === "provider" ? routes.providerDashboard : isAdmin ? routes.admin : routes.parentProfile;
  const accountLabel = user?.role === "provider" ? "My listing" : isAdmin ? "Verification desk" : "My family";

  const switchRole = async (target: "parent" | "provider") => {
    if (!user || user.role === target || switching) return;
    setSwitching(true);
    setSwitchError("");
    const response = await fetch("/api/account/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ target }),
    }).catch(() => null);
    setSwitching(false);
    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => null) : null;
      setSwitchError(payload?.error ?? "Could not switch account type.");
      return;
    }
    notifyPlatformSessionChanged();
    router.push(target === "provider" ? routes.providerDashboard : routes.parentProfile);
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    router.push(routes.home);
  };

  const navItems = isAdmin ? [...NAV, { href: routes.admin, label: "Admin" }] : NAV;

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid #d7edf0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px 28px" }}>
        <Link href={routes.home} aria-label="Kidcellence home" style={{ flexShrink: 0 }}>
          <BrandMark />
        </Link>

        <nav aria-label="Main" className="kc-nav hidden lg:flex" style={{ gap: 24, flex: 1, alignItems: "center" }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex" style={{ gap: 12, alignItems: "center", marginLeft: "auto" }}>
          {user ? (
            <>
              {canSwitchDirectly && (
                <div role="group" aria-label="Switch account type" style={{ display: "flex", background: "#f4fbfc", border: "1px solid #d7edf0", borderRadius: 999, padding: 4 }}>
                  {(["parent", "provider"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={switching}
                      aria-pressed={user.role === role}
                      onClick={() => switchRole(role)}
                      style={user.role === role ? roleOn : roleOff}
                    >
                      {role === "parent" ? "Parent" : "Provider"}
                    </button>
                  ))}
                </div>
              )}
              <details style={{ position: "relative" }}>
                <summary aria-label="Account menu" style={{ width: 44, height: 44, borderRadius: "50%", background: "#ffcc2f", color: "#3f3e44", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                  {initialsOf(user.name)}
                </summary>
                <div className="kc-side" style={{ position: "absolute", right: 0, top: 52, width: 240, background: "#ffffff", border: "1px solid #d7edf0", borderRadius: 18, boxShadow: "0 14px 40px rgba(42,123,134,.14)", padding: 8 }}>
                  <p style={{ margin: 0, padding: "8px 14px 10px", fontSize: 13, color: "#686973", borderBottom: "1px solid #d7edf0", marginBottom: 6 }}>
                    Signed in as <strong style={{ color: "#3f3e44", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</strong>
                  </p>
                  <Link href={homeHref}>{accountLabel}</Link>
                  <Link href={routes.settings}><Icon name="gear" size={18} />Settings</Link>
                  <button type="button" onClick={handleLogout}>Sign out</button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href={routes.login} aria-disabled={loading} style={{ padding: "12px 18px", borderRadius: 999, color: "#3f3e44", textDecoration: "none", fontWeight: 700, fontSize: 15 }}>Log in</Link>
              <Link href={routes.auth} className="kc-btn">Sign up</Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex items-center justify-center lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="kc-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
          style={{ marginLeft: "auto", width: 44, height: 44, borderRadius: "50%", border: "1px solid #d7edf0", background: "#ffffff" }}
        >
          <Icon name={menuOpen ? "x" : "menu"} size={20} color="#3f3e44" />
        </button>
      </div>

      {switchError && (
        <p role="alert" style={{ margin: 0, padding: "8px 24px", background: "#fff5d3", color: "#c2412a", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
          {switchError}
        </p>
      )}

      {menuOpen && (
        <div id="kc-mobile-menu" className="lg:hidden" style={{ borderTop: "1px solid #d7edf0", background: "#ffffff", padding: "12px 16px 20px" }}>
          <nav aria-label="Main" className="kc-side" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid #d7edf0" }}>
            {user ? (
              <>
                {canSwitchDirectly && (
                  <div role="group" aria-label="Switch account type" style={{ display: "flex", background: "#f4fbfc", border: "1px solid #d7edf0", borderRadius: 999, padding: 4, alignSelf: "flex-start" }}>
                    {(["parent", "provider"] as const).map((role) => (
                      <button key={role} type="button" disabled={switching} aria-pressed={user.role === role} onClick={() => switchRole(role)} style={user.role === role ? roleOn : roleOff}>
                        {role === "parent" ? "Parent" : "Provider"}
                      </button>
                    ))}
                  </div>
                )}
                <Link href={homeHref} className="kc-btn-outline">{accountLabel}</Link>
                <Link href={routes.settings} className="kc-btn-outline">Settings</Link>
                <button type="button" onClick={handleLogout} style={{ minHeight: 44, border: 0, background: "transparent", color: "#686973", fontWeight: 700 }}>Sign out</button>
              </>
            ) : (
              <>
                <Link href={routes.auth} className="kc-btn">Sign up</Link>
                <Link href={routes.login} className="kc-btn-outline">Log in</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
