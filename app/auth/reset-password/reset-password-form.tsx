"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [complete, setComplete] = useState(false);

  const submit = async (formData: FormData) => {
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (!token) {
      setStatus("This reset link is incomplete. Request a new one from the login page.");
      return;
    }
    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setStatus("Passwords do not match.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Could not reset the password.");
      return;
    }

    setComplete(true);
    setStatus("Password updated. Sign in with your new password.");
  };

  return (
    <main className="brand-page flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center" aria-label="Kidcexcellence home">
          <BrandMark />
        </Link>
        <div className="brand-card p-8">
          <KeyRound className="mb-4 h-7 w-7 text-[var(--brand-leaf)]" aria-hidden="true" />
          <h1 className="text-2xl font-black text-[var(--brand-ink)]">Choose a new password</h1>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            Use at least eight characters and keep it unique to this account.
          </p>

          {!complete && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(new FormData(event.currentTarget));
              }}
            >
              <PasswordField
                name="password"
                label="New password"
                show={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
              <PasswordField
                name="confirmation"
                label="Confirm password"
                show={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-ink)]"
              >
                Update password
              </Button>
            </form>
          )}

          {status && (
            <p
              className="mt-5 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-3 text-sm font-bold text-[var(--brand-muted)]"
              role="status"
            >
              {status}
            </p>
          )}

          <Link
            href="/auth"
            className="mt-5 block text-center text-sm font-black text-[var(--brand-leaf)] hover:underline"
          >
            Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

function PasswordField({
  name,
  label,
  show,
  onToggle,
}: {
  name: string;
  label: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <Label htmlFor={name} className="text-sm font-bold text-[var(--brand-ink)]">
        {label}
      </Label>
      <div className="relative mt-1">
        <Input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded-lg border-[var(--brand-line)] pr-10 focus-visible:ring-[var(--brand-leaf)]"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand-muted)]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
