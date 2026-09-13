"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  LogIn,
  LogOut,
  Mail,
  Settings as SettingsIcon,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
      <div className="min-h-screen brand-page px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-[var(--brand-line)] bg-white p-6 text-center text-sm font-bold text-[var(--brand-muted)] shadow-sm">
          Checking your account...
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="min-h-screen brand-page px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-[var(--brand-line)] bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--brand-ivory)] text-[var(--brand-leaf)]">
            <SettingsIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-[var(--brand-ink)]">
            Sign in to manage your account
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--brand-muted)]">
            Account settings let you change your account type, check your email
            verification, and sign out.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth?mode=login">
              <Button
                variant="outline"
                className="w-full rounded-full border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)] sm:w-auto"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            </Link>
            <Link href="/auth">
              <Button className="w-full rounded-full bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-coral)] sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" />
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen brand-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--brand-ink)]">Settings</h1>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            Manage how you use Kidcellence.
          </p>
        </div>

        {notice && (
          <div className="rounded-lg border border-[var(--brand-leaf)] bg-[var(--brand-ivory)] px-4 py-3 text-sm font-bold text-[var(--brand-ink)]">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-[var(--brand-coral)] bg-white px-4 py-3 text-sm font-bold text-[var(--brand-coral)]">
            {error}
          </div>
        )}

        <Card className="rounded-lg border-[var(--brand-line)] shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[var(--brand-ink)]">
              Account type
            </CardTitle>
            <CardDescription className="text-[var(--brand-muted)]">
              {isAdmin
                ? "Your account type is managed by Kidcellence."
                : "Switch between using Kidcellence as a family or as a provider. Your information for both is kept."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[var(--brand-ink)]">
                Currently using:
              </span>
              <Badge className="bg-[var(--brand-leaf)] font-black text-white">
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
              {heldRoles.length > 1 && (
                <span className="text-xs text-[var(--brand-muted)]">
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
              <div className="flex items-start gap-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-leaf)]" />
                <p className="text-sm leading-6 text-[var(--brand-muted)]">
                  Admin access is enabled for your email address by Kidcellence
                  and cannot be changed here.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(["parent", "provider"] as SwitchableRole[]).map((role) => {
                  const active = user.role === role;
                  const Icon = role === "parent" ? Users : Briefcase;
                  return (
                    <div
                      key={role}
                      className={`rounded-lg border p-4 ${
                        active
                          ? "border-[var(--brand-leaf)] bg-[var(--brand-ivory)]"
                          : "border-[var(--brand-line)] bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-[var(--brand-leaf)]" />
                        <span className="font-black text-[var(--brand-ink)]">
                          {ROLE_LABELS[role]}
                        </span>
                        {active && (
                          <BadgeCheck className="ml-auto h-5 w-5 text-[var(--brand-leaf)]" />
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--brand-muted)]">
                        {ROLE_BLURBS[role]}
                      </p>
                      <Button
                        className="mt-4 w-full rounded-full font-black"
                        variant={active ? "outline" : "default"}
                        disabled={active}
                        onClick={() => {
                          setError("");
                          setNotice("");
                          setPendingRole(role);
                        }}
                      >
                        {active ? "Current" : `Switch to ${ROLE_LABELS[role].toLowerCase()}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[var(--brand-line)] shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[var(--brand-ink)]">
              Email
            </CardTitle>
            <CardDescription className="text-[var(--brand-muted)]">
              Used to sign in and to contact you about your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Mail className="h-5 w-5 text-[var(--brand-leaf)]" />
              <span className="text-sm font-bold text-[var(--brand-ink)]">
                {user.email}
              </span>
              {user.emailVerifiedAt ? (
                <Badge className="bg-[var(--brand-leaf)] font-black text-white">
                  Verified
                </Badge>
              ) : (
                <Link href="/auth/verify-email">
                  <Button
                    variant="outline"
                    className="rounded-full border-[var(--brand-line)] bg-white text-xs font-black text-[var(--brand-ink)]"
                  >
                    Verify email
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[var(--brand-line)] shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[var(--brand-ink)]">
              Session
            </CardTitle>
            <CardDescription className="text-[var(--brand-muted)]">
              Sign out of Kidcellence on this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="rounded-full border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
      >
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[var(--brand-ink)]">
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
              className="rounded-full border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]"
              onClick={() => setPendingRole(null)}
              disabled={switching}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-coral)]"
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
