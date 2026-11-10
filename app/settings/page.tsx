"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/kidcellence/Icon";
import { routes } from "@/lib/kidcellence/routes";
import {
  notifyPlatformSessionChanged,
  usePlatformSession,
} from "@/lib/use-platform-session";

type SwitchableRole = "parent" | "provider";

const ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  provider: "Provider",
  admin: "Admin",
};

const ROLE_BLURBS: Record<SwitchableRole, string> = {
  parent: "Browse and compare providers, send enquiries, and message providers.",
  provider: "Publish a listing, upload documents, and track your profile analytics.",
};

// Design styles (SettingsScreen).
const card: CSSProperties = { background: "#ffffff", borderRadius: 24, padding: 24, display: "flex", flexDirection: "column", boxShadow: "0 6px 20px rgba(63,62,68,.06)", minWidth: 0 };
const sectionTitle: CSSProperties = { margin: 0, fontSize: 22, fontWeight: 800 };
const sectionBody: CSSProperties = { margin: 0, fontSize: 15, color: "#686973", lineHeight: 1.5 };

function CenteredPanel({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "#f4fbfc", minHeight: "70vh", padding: "48px 16px" }}>
      <div className="kc-panel" style={{ maxWidth: 560, margin: "0 auto", padding: 32, textAlign: "center", color: "#3f3e44" }}>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, session, loading, logout } = usePlatformSession();
  const [pendingRole, setPendingRole] = useState<SwitchableRole | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const heldRoles = user?.roles ?? (user ? [user.role] : []);
  const isAdmin = user?.role === "admin";

  const confirmSwitch = async () => {
    if (!pendingRole) return;
    setSwitching(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/account/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ target: pendingRole }),
    }).catch(() => null);

    setSwitching(false);

    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => null) : null;
      // Close the dialog so the error banner is not hidden behind its overlay.
      setPendingRole(null);
      setError(payload?.error ?? "Could not change your account type.");
      return;
    }

    const label = ROLE_LABELS[pendingRole];
    setPendingRole(null);
    setNotice(`You are now using your ${label.toLowerCase()} account.`);
    // usePlatformSession listens for this event, so one dispatch refreshes this
    // page and every other mounted consumer (the navbar) with a single fetch.
    notifyPlatformSessionChanged();
  };

  if (loading) {
    return (
      <CenteredPanel>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#686973" }}>Checking your account...</p>
      </CenteredPanel>
    );
  }

  if (!session || !user) {
    return (
      <CenteredPanel>
        <span style={{ margin: "0 auto", width: 56, height: 56, borderRadius: "50%", background: "#f4fbfc", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="gear" size={28} color="#2a7b86" />
        </span>
        <h1 style={{ margin: "20px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Sign in to manage your account
        </h1>
        <p style={{ margin: "12px auto 0", maxWidth: 420, fontSize: 15, lineHeight: 1.6, color: "#686973" }}>
          Account settings let you change your account type, check your email
          verification, and sign out.
        </p>
        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <Link href={routes.login} className="kc-btn-outline">Login</Link>
          <Link href={routes.auth} className="kc-btn">Sign up</Link>
        </div>
      </CenteredPanel>
    );
  }

  return (
    <div style={{ color: "#3f3e44", background: "#f4fbfc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px 96px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: "-1px" }}>Settings</h1>
          <p style={{ ...sectionBody, marginTop: 6 }}>Manage how you use Kidcellence.</p>
        </div>

        {notice && (
          <div role="status" style={{ borderRadius: 14, border: "1px solid #54b2bf", background: "#ffffff", padding: "12px 16px", fontSize: 14, fontWeight: 700 }}>
            {notice}
          </div>
        )}
        {error && (
          <div role="alert" style={{ borderRadius: 14, border: "1px solid #f05a3c", background: "#ffffff", padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#c2412a" }}>
            {error}
          </div>
        )}

        <section aria-labelledby="roles-h" style={{ ...card, gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h2 id="roles-h" style={sectionTitle}>Account type</h2>
            <p style={sectionBody}>
              {isAdmin
                ? "Your account type is managed by Kidcellence."
                : "Switch between using Kidcellence as a family or as a provider. Your information for both is kept."}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 14 }}>
            <strong>Currently using:</strong>
            <span style={{ padding: "4px 12px", borderRadius: 999, background: "#2a7b86", color: "#ffffff", fontWeight: 800, fontSize: 13 }}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            {heldRoles.length > 1 && (
              <span style={{ fontSize: 13, color: "#686973" }}>
                You also have a{" "}
                {heldRoles
                  .filter((role) => role !== user.role)
                  .map((role) => (ROLE_LABELS[role] ?? role).toLowerCase())
                  .join(" and ")}{" "}
                account on this login.
              </span>
            )}
          </div>

          {isAdmin ? (
            <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: "#686973", background: "#f4fbfc", borderRadius: 14, padding: "12px 14px" }}>
              <Icon name="shieldCheck" size={18} color="#2a7b86" style={{ flex: "0 0 auto", marginTop: 1 }} />
              Admin access is enabled for your email address by Kidcellence
              and cannot be changed here.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 14 }}>
              {(["parent", "provider"] as SwitchableRole[]).map((role) => {
                const active = user.role === role;
                const line = active ? "#2a7b86" : "#d7edf0";
                return (
                  <div
                    key={role}
                    style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20, borderRadius: 20, border: `2px solid ${line}`, background: active ? "#f4fbfc" : "#ffffff", minWidth: 0 }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", background: role === "parent" ? "#ffcc2f" : "#54b2bf", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name={role === "parent" ? "nanny" : "agency"} size={22} color="#3f3e44" />
                        </span>
                        <strong style={{ fontSize: 20 }}>{ROLE_LABELS[role]}</strong>
                      </span>
                      {active && <Icon name="check" size={22} color="#2a7b86" strokeWidth={2.6} label="Current account type" />}
                    </span>
                    <span style={{ fontSize: 15, color: "#686973", lineHeight: 1.5 }}>{ROLE_BLURBS[role]}</span>
                    <button
                      type="button"
                      className={active ? "kc-btn-outline" : "kc-btn"}
                      style={{ marginTop: "auto" }}
                      disabled={active}
                      onClick={() => {
                        setError("");
                        setNotice("");
                        setPendingRole(role);
                      }}
                    >
                      {active ? "Current" : `Switch to ${ROLE_LABELS[role].toLowerCase()}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="email-h" style={{ ...card, gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h2 id="email-h" style={sectionTitle}>Email</h2>
            <p style={sectionBody}>Used to sign in and to contact you about your account.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Icon name="message" size={20} color="#2a7b86" />
            <strong style={{ fontSize: 15, overflowWrap: "anywhere", minWidth: 0 }}>{user.email}</strong>
            {user.emailVerifiedAt ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "#ffffff", border: "1px solid #d7edf0", color: "#2a7b86", fontWeight: 800, fontSize: 12 }}>
                <Icon name="shieldCheck" size={14} color="#2a7b86" />Verified
              </span>
            ) : (
              <Link href="/auth/verify-email" className="kc-btn-outline" style={{ minHeight: 40, padding: "8px 16px", fontSize: 14 }}>
                Verify email
              </Link>
            )}
          </div>
        </section>

        <section aria-labelledby="session-h" style={{ ...card, gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h2 id="session-h" style={sectionTitle}>Session</h2>
            <p style={sectionBody}>Sign out of Kidcellence on this device.</p>
          </div>
          <button type="button" className="kc-btn-outline" style={{ alignSelf: "flex-start" }} onClick={logout}>
            Sign out
          </button>
        </section>
      </div>

      <Dialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[var(--brand-ink)]">
              Switch to a {pendingRole ? ROLE_LABELS[pendingRole].toLowerCase() : ""} account?
            </DialogTitle>
            <DialogDescription className="text-[var(--brand-muted)]">
              {pendingRole === "provider"
                ? "Your provider listing stays unpublished until you publish it, and verification starts as not submitted."
                : "Your provider listing and documents are kept, but your listing stops being shown to families while you use your parent account."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-6 text-[var(--brand-muted)]">
            Nothing is deleted, and you can switch back at any time.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full border-[var(--brand-line)] bg-white font-extrabold text-[var(--brand-ink)]"
              onClick={() => setPendingRole(null)}
              disabled={switching}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-[var(--brand-teal)] font-extrabold text-white hover:bg-[var(--brand-teal-hover)]"
              onClick={confirmSwitch}
              disabled={switching}
            >
              {switching ? "Switching..." : "Switch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
