"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/kidcellence/Icon";
import { routes } from "@/lib/kidcellence/routes";
import { usePlatformSession } from "@/lib/use-platform-session";

interface Child {
  id: string;
  name: string;
  dob: string;
  specialNeeds: string;
}

interface ParentFormState {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  location: string;
  phone: string;
  bio: string;
  children: Child[];
}

const EMPTY_PROFILE: ParentFormState = {
  fullName: "",
  dateOfBirth: "",
  nationality: "",
  location: "",
  phone: "",
  bio: "",
  children: [],
};

const LOCATIONS = [
  { value: "gaborone", label: "Gaborone" },
  { value: "francistown", label: "Francistown" },
  { value: "maun", label: "Maun" },
  { value: "lobatse", label: "Lobatse" },
  { value: "serowe", label: "Serowe" },
];

// Design styles (ParentProfileScreen).
const card: CSSProperties = { background: "#ffffff", borderRadius: 24, display: "flex", flexDirection: "column", boxShadow: "0 6px 20px rgba(63,62,68,.06)" };
const fieldLabel: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 700, minWidth: 0 };
const field: CSSProperties = { minHeight: 48, padding: "0 14px", borderRadius: 14, border: "1px solid #d7edf0", background: "#f4fbfc", fontSize: 16, fontWeight: 500, color: "#3f3e44", width: "100%", minWidth: 0 };
const childField: CSSProperties = { ...field, background: "#ffffff" };
const textArea: CSSProperties = { ...field, minHeight: 0, padding: "12px 14px", resize: "vertical", lineHeight: 1.5 };
const CHILD_TINTS = [
  { bg: "#f4fbfc", avatar: "#54b2bf" },
  { bg: "#fff5d3", avatar: "#ffcc2f" },
];

function childAge(dob: string) {
  if (!dob) return "";
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return "";
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return "";
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} years`;
}

function SignedOutShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "#f4fbfc", minHeight: "70vh", padding: "48px 16px" }}>
      <div className="kc-panel" style={{ maxWidth: 560, margin: "0 auto", padding: 32, textAlign: "center", color: "#3f3e44" }}>
        {children}
      </div>
    </div>
  );
}

export default function ParentProfilePage() {
  const { user, session, loading, refresh: refreshSession } = usePlatformSession();
  const [profile, setProfile] = useState<ParentFormState>(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState<ParentFormState>(EMPTY_PROFILE);
  const [saveMessage, setSaveMessage] = useState("");
  const children = profile.children;

  const refreshProfile = useCallback(async () => {
    if (!session) return;

    const response = await fetch("/api/profiles/parent", {
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return;

    const payload = await response.json();
    const nextProfile: ParentFormState = {
      fullName: payload.profile?.fullName ?? payload.user?.name ?? "",
      dateOfBirth: payload.profile?.dateOfBirth ?? "",
      nationality: payload.profile?.nationality ?? "",
      location: payload.profile?.location ?? payload.user?.location ?? "",
      phone: payload.profile?.phone ?? payload.user?.phone ?? "",
      bio: payload.profile?.bio ?? "",
      children: Array.isArray(payload.profile?.children) ? payload.profile.children : [],
    };
    setProfile(nextProfile);
    setSavedProfile(nextProfile);
  }, [session]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      refreshProfile();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshProfile]);

  const addChild = () => {
    setProfile((current) => ({
      ...current,
      children: [
        ...current.children,
        { id: crypto.randomUUID(), name: "", dob: "", specialNeeds: "" },
      ],
    }));
  };

  const removeChild = (id: string) => {
    setProfile((current) => ({
      ...current,
      children: current.children.filter((child) => child.id !== id),
    }));
  };

  const updateChild = (id: string, field: keyof Child, value: string) => {
    setProfile((current) => ({
      ...current,
      children: current.children.map((child) =>
        child.id === id ? { ...child, [field]: value } : child
      ),
    }));
  };

  const handleSave = async () => {
    if (!session) {
      setSaveMessage("Sign in to save your family profile.");
      return;
    }

    const response = await fetch("/api/profiles/parent", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.userId, profile }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setSaveMessage(payload?.error ?? "Could not save profile.");
      return;
    }

    const payload = await response.json();
    const nextProfile = { ...profile, ...payload.profile };
    setProfile(nextProfile);
    setSavedProfile(nextProfile);
    await refreshSession();
    setSaveMessage("Saved!");
    setTimeout(() => setSaveMessage(""), 3000);
  };

  if (loading) {
    return (
      <SignedOutShell>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#686973" }}>Checking your account...</p>
      </SignedOutShell>
    );
  }

  if (!loading && (!session || user?.role !== "parent")) {
    return (
      <SignedOutShell>
        <span style={{ margin: "0 auto", width: 56, height: 56, borderRadius: "50%", background: "#f4fbfc", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="nanny" size={28} color="#2a7b86" />
        </span>
        <h1 style={{ margin: "20px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Sign in to open your family profile
        </h1>
        <p style={{ margin: "12px auto 0", maxWidth: 420, fontSize: 15, lineHeight: 1.6, color: "#686973" }}>
          Parent accounts can save child details, manage enquiries, and message providers from a private dashboard.
        </p>
        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <Link href={routes.login} className="kc-btn-outline">Login</Link>
          <Link href={routes.auth} className="kc-btn">Sign up as parent</Link>
        </div>
      </SignedOutShell>
    );
  }

  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const locationKnown = !profile.location || LOCATIONS.some((option) => option.value === profile.location);

  return (
    <div style={{ color: "#3f3e44", background: "#f4fbfc", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 16px 96px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: "#686973", fontWeight: 600 }}>Parent profile{user?.name ? ` · ${user.name}` : ""}</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 36, fontWeight: 800, letterSpacing: "-1px" }}>My family</h1>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            <section aria-labelledby="kids-h" style={{ ...card, padding: 24, gap: 18 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h2 id="kids-h" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Children</h2>
                <button type="button" onClick={addChild} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 16px", borderRadius: 14, border: "2px solid #2a7b86", background: "#ffffff", color: "#2a7b86", fontWeight: 800, fontSize: 14 }}>
                  <Icon name="plus" size={16} color="#2a7b86" strokeWidth={2.4} />Add child
                </button>
              </div>

              {children.length === 0 && (
                <div style={{ padding: "32px 16px", borderRadius: 20, border: "2px dashed #54b2bf", background: "#f4fbfc", textAlign: "center", fontSize: 15, color: "#686973" }}>
                  No children added yet.
                </div>
              )}

              {children.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                  {children.map((child, idx) => {
                    const tint = CHILD_TINTS[idx % CHILD_TINTS.length];
                    const age = childAge(child.dob);
                    return (
                      <article key={child.id} style={{ padding: 20, borderRadius: 20, background: tint.bg, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span aria-hidden="true" style={{ flex: "0 0 auto", width: 52, height: 52, borderRadius: "50%", background: tint.avatar, color: "#3f3e44", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20 }}>
                            {child.name.trim() ? child.name.trim()[0].toUpperCase() : idx + 1}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{child.name.trim() || `Child ${idx + 1}`}</strong>
                            {age && <span style={{ fontSize: 14, color: "#686973" }}>{age}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeChild(child.id)}
                            aria-label={`Remove ${child.name || `child ${idx + 1}`}`}
                            style={{ flex: "0 0 auto", width: 44, height: 44, borderRadius: 12, border: "1px solid #d7edf0", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Icon name="trash" size={18} color="#c2412a" />
                          </button>
                        </div>
                        <label style={fieldLabel}>
                          Child&apos;s name
                          <input value={child.name} onChange={(e) => updateChild(child.id, "name", e.target.value)} placeholder="e.g. Lebo" style={childField} />
                        </label>
                        <label style={fieldLabel}>
                          Date of birth
                          <input type="date" value={child.dob} onChange={(e) => updateChild(child.id, "dob", e.target.value)} style={childField} />
                        </label>
                        <label style={fieldLabel}>
                          <span>Special needs / notes <span style={{ fontWeight: 500, color: "#686973" }}>(optional)</span></span>
                          <textarea
                            value={child.specialNeeds}
                            onChange={(e) => updateChild(child.id, "specialNeeds", e.target.value)}
                            placeholder="Any allergies, medical conditions, or special requirements..."
                            rows={2}
                            style={{ ...textArea, background: "#ffffff" }}
                          />
                        </label>
                      </article>
                    );
                  })}
                </div>
              )}

              <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: "#686973", background: "#f4fbfc", borderRadius: 14, padding: "12px 14px" }}>
                <Icon name="lock" size={18} color="#2a7b86" style={{ flex: "0 0 auto", marginTop: 1 }} />
                Your children&apos;s details are private. A provider only sees them if you choose to share them in a message.
              </p>
            </section>
          </div>

          <aside style={{ flex: "1 1 320px", minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
            <section aria-labelledby="me-h" style={{ ...card, padding: 24, gap: 14 }}>
              <h2 id="me-h" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Guardian details</h2>
              <label style={fieldLabel}>
                Full name
                <input value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} placeholder="Your full name" style={field} />
              </label>
              <label style={fieldLabel}>
                Mobile
                <input type="tel" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="+267 71 234 567" style={field} />
              </label>
              <label style={fieldLabel}>
                Area
                <select value={profile.location} onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))} style={field}>
                  <option value="">Select your city</option>
                  {!locationKnown && <option value={profile.location}>{profile.location}</option>}
                  {LOCATIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label style={fieldLabel}>
                Date of birth
                <input type="date" value={profile.dateOfBirth} onChange={(event) => setProfile((current) => ({ ...current, dateOfBirth: event.target.value }))} style={field} />
              </label>
              <label style={fieldLabel}>
                Nationality
                <input value={profile.nationality} onChange={(event) => setProfile((current) => ({ ...current, nationality: event.target.value }))} placeholder="Motswana" style={field} />
              </label>
              <label style={fieldLabel}>
                Email address
                <input type="email" value={user?.email ?? ""} readOnly style={{ ...field, color: "#686973" }} />
              </label>
              <label style={fieldLabel}>
                About me
                <textarea
                  value={profile.bio}
                  onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                  placeholder="Share anything useful for providers supporting your family."
                  rows={3}
                  style={textArea}
                />
              </label>
            </section>

            <section style={{ background: "#fff5d3", borderRadius: 24, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ alignSelf: "flex-start", background: "#ffffff", color: "#c2412a", fontWeight: 800, fontSize: 12, padding: "5px 10px", borderRadius: 999, letterSpacing: ".4px" }}>ALSO A PROVIDER?</span>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>One account can hold both roles. You can switch to a provider account in Settings.</p>
              <Link href={routes.settings} style={{ fontWeight: 800, color: "#2a7b86" }}>Go to settings</Link>
            </section>
          </aside>
        </div>

        <div className="kc-panel" style={{ padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <span role="status" style={{ marginRight: "auto", fontSize: 14, fontWeight: 700, color: saveMessage === "Saved!" ? "#2a7b86" : "#686973" }}>
            {saveMessage === "Saved!" ? "Your family profile is saved." : dirty ? "You have unsaved changes." : ""}
          </span>
          <button
            type="button"
            className="kc-btn-outline"
            onClick={() => {
              setProfile(savedProfile);
              setSaveMessage("");
            }}
          >
            Cancel
          </button>
          <button type="button" className="kc-btn" onClick={handleSave} disabled={loading}>
            {saveMessage === "Saved!" ? "Saved!" : "Save changes"}
          </button>
        </div>
        {saveMessage && saveMessage !== "Saved!" && (
          <div role="alert" style={{ borderRadius: 14, border: "1px solid #d7edf0", background: "#ffffff", padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#c2412a" }}>
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  );
}
