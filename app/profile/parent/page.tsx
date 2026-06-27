"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, User } from "lucide-react";
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

  return (
    <div className="min-h-screen brand-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[var(--brand-ink)]">My Profile</h1>
          <p className="text-[var(--brand-muted)] mt-1">Manage your account and children&apos;s information</p>
        </div>

        {/* Cover + Avatar */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm overflow-hidden mb-6">
          <div
            className="h-32 relative"
            style={{ background: "linear-gradient(135deg, var(--brand-leaf), var(--brand-gold))" }}
          />
          <div className="px-6 pb-6">
            <div className="relative -mt-12 mb-4 w-fit">
              <div className="w-20 h-20 rounded-lg bg-[var(--brand-ivory)] border-4 border-white shadow-md flex items-center justify-center">
                <User className="w-10 h-10 text-[var(--brand-leaf)]" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-[var(--brand-ink)]">{user?.name ?? "Parent profile"}</h2>
            <p className="text-[var(--brand-muted)] text-sm">
              {user ? `Parent · ${user.location ?? "Botswana"}` : "Sign in to sync this profile"}
            </p>
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-[var(--brand-ink)] mb-5">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Full Name</Label>
              <Input value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} placeholder="Mpho Dlamini" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Date of Birth</Label>
              <Input type="date" value={profile.dateOfBirth} onChange={(event) => setProfile((current) => ({ ...current, dateOfBirth: event.target.value }))} className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Nationality</Label>
              <Input value={profile.nationality} onChange={(event) => setProfile((current) => ({ ...current, nationality: event.target.value }))} placeholder="Motswana" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Location</Label>
              <Select value={profile.location} onValueChange={(value) => setProfile((current) => ({ ...current, location: value ?? "" }))}>
                <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                  <SelectValue placeholder="Select your city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gaborone">Gaborone</SelectItem>
                  <SelectItem value="francistown">Francistown</SelectItem>
                  <SelectItem value="maun">Maun</SelectItem>
                  <SelectItem value="lobatse">Lobatse</SelectItem>
                  <SelectItem value="serowe">Serowe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Phone Number</Label>
              <Input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="+267 71 234 567" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--brand-ink)]">Email Address</Label>
              <Input type="email" value={user?.email ?? ""} readOnly className="mt-1 rounded-lg border-[var(--brand-line)] bg-[var(--brand-ivory)]" />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-sm font-medium text-[var(--brand-ink)]">About Me</Label>
            <Textarea
              value={profile.bio}
              onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
              placeholder="Share anything useful for providers supporting your family."
              className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Children */}
        <div className="bg-white rounded-lg border border-[var(--brand-line)] shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-[var(--brand-ink)]">My Children</h3>
            <Button
              size="sm"
              onClick={addChild}
              className="rounded-lg text-white text-sm flex items-center gap-1"
              style={{ background: "var(--brand-leaf)" }}
            >
              <Plus className="w-4 h-4" />
              Add Child
            </Button>
          </div>

          <div className="space-y-5">
            {children.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-8 text-center text-sm text-[var(--brand-muted)]">
                No children added yet.
              </div>
            )}
            {children.map((child, idx) => (
              <div key={child.id}>
                {idx > 0 && <Separator className="mb-5" />}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{ background: "linear-gradient(135deg, var(--brand-leaf), var(--brand-gold))" }}
                    >
                      {idx + 1}
                    </div>
                    <span className="font-semibold text-[var(--brand-ink)] text-sm">Child {idx + 1}</span>
                  </div>
                  <button
                    onClick={() => removeChild(child.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    aria-label={`Remove ${child.name || `child ${idx + 1}`}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-[var(--brand-muted)]">Child&apos;s Name</Label>
                    <Input
                      value={child.name}
                      onChange={(e) => updateChild(child.id, "name", e.target.value)}
                      placeholder="e.g. Lebo"
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-[var(--brand-muted)]">Date of Birth</Label>
                    <Input
                      type="date"
                      value={child.dob}
                      onChange={(e) => updateChild(child.id, "dob", e.target.value)}
                      className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs font-medium text-[var(--brand-muted)]">
                    Special Needs / Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    value={child.specialNeeds}
                    onChange={(e) => updateChild(child.id, "specialNeeds", e.target.value)}
                    placeholder="Any allergies, medical conditions, or special requirements..."
                    className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] resize-none text-sm"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setProfile(savedProfile);
              setSaveMessage("");
            }}
            className="rounded-lg border-[var(--brand-line)] text-[var(--brand-muted)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg text-white font-semibold px-8"
            style={{ background: "var(--brand-leaf)" }}
          >
            {saveMessage === "Saved!" ? "Saved!" : "Save Changes"}
          </Button>
        </div>
        {saveMessage && saveMessage !== "Saved!" && (
          <div className="mt-4 rounded-lg border border-[var(--brand-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--brand-coral)]">
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  );
}
