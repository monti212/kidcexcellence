"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CircleAlert, LoaderCircle, MailCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VerificationState = "request" | "loading" | "verified" | "error";

export function VerifyEmailPanel({ token }: { token: string }) {
  const [state, setState] = useState<VerificationState>(token ? "loading" : "request");
  const [message, setMessage] = useState(
    token ? "Confirming your email address..." : "Enter your account email to request a verification link."
  );
  const [verificationHref, setVerificationHref] = useState("");

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setState("error");
        setMessage(payload.error ?? "Could not verify this email address.");
        return;
      }
      setState("verified");
      setMessage("Your email is verified. Your account is ready.");
    };

    void verify();
  }, [token]);

  const requestVerification = async (formData: FormData) => {
    const email = String(formData.get("email") ?? "");
    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not request email verification.");
      return;
    }

    if (payload.alreadyVerified) {
      setState("verified");
      setMessage("This email address is already verified.");
      return;
    }

    setState("request");
    setMessage("If the account exists, verification instructions are ready.");
    setVerificationHref(
      payload.delivery?.token
        ? `/auth/verify-email?token=${encodeURIComponent(payload.delivery.token)}`
        : ""
    );
  };

  const Icon =
    state === "loading"
      ? LoaderCircle
      : state === "verified"
        ? BadgeCheck
        : state === "error"
          ? CircleAlert
          : MailCheck;

  return (
    <main className="brand-page flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center" aria-label="Kidcexcellence home">
          <BrandMark />
        </Link>
        <div className="brand-card p-8 text-center">
          <Icon
            className={`mx-auto h-10 w-10 text-[var(--brand-leaf)] ${
              state === "loading" ? "animate-spin" : ""
            }`}
            aria-hidden="true"
          />
          <h1 className="mt-5 text-2xl font-black text-[var(--brand-ink)]">
            {state === "verified" ? "Email verified" : "Verify your email"}
          </h1>
          <p className="mt-3 text-sm font-bold text-[var(--brand-muted)]" role="status">
            {message}
          </p>
          {(state === "request" || (state === "error" && !token)) && (
            <form
              className="mt-6 text-left"
              onSubmit={(event) => {
                event.preventDefault();
                void requestVerification(new FormData(event.currentTarget));
              }}
            >
              <Label htmlFor="verification-email" className="text-sm font-bold text-[var(--brand-ink)]">
                Email
              </Label>
              <Input
                id="verification-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
              />
              <Button
                type="submit"
                className="mt-4 h-11 w-full rounded-lg bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-ink)]"
              >
                Send verification link
              </Button>
            </form>
          )}
          {verificationHref && (
            <Link
              href={verificationHref}
              className="mt-4 block text-sm font-black text-[var(--brand-leaf)] hover:underline"
            >
              Open development verification link
            </Link>
          )}
          <Link
            href="/auth"
            className="mt-6 inline-block text-sm font-black text-[var(--brand-leaf)] hover:underline"
          >
            {state === "verified" ? "Continue to sign in" : "Return to account access"}
          </Link>
        </div>
      </section>
    </main>
  );
}
