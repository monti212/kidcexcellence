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
    <div className="flex min-h-screen items-start justify-center bg-[var(--brand-ivory)] px-4 py-10 sm:items-center sm:py-14">
      <section className="w-full max-w-md">
        <Link href="/" className="mb-6 flex justify-center" aria-label="Kidcellence home">
          <BrandMark />
        </Link>
        <div className="rounded-3xl border border-[var(--brand-line)] bg-white p-6 shadow-[0_6px_20px_rgba(63,62,68,.06)] sm:p-8">
          <KeyRound className="mb-4 h-7 w-7 text-[var(--brand-teal)]" aria-hidden="true" />
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)]">Choose a new password</h1>
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
                className="h-12 w-full rounded-full bg-[var(--brand-teal)] text-base font-extrabold text-white shadow-[0_6px_16px_rgba(42,123,134,.28)] hover:bg-[var(--brand-teal-hover)]"
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
            className="mt-5 block text-center text-sm font-extrabold text-[var(--brand-teal)] hover:underline"
          >
            Return to sign in
          </Link>
        </div>
      </section>
    </div>
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
          className="h-12 rounded-[14px] border-[var(--brand-line)] bg-[var(--brand-ivory)] text-base pr-12 focus-visible:ring-[var(--brand-teal)]"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--brand-muted)] hover:text-[var(--brand-ink)]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
