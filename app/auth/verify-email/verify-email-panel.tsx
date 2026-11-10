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
    <div className="flex min-h-screen items-start justify-center bg-[var(--brand-ivory)] px-4 py-10 sm:items-center sm:py-14">
      <section className="w-full max-w-md">
        <Link href="/" className="mb-6 flex justify-center" aria-label="Kidcellence home">
          <BrandMark />
        </Link>
        <div className="rounded-3xl border border-[var(--brand-line)] bg-white p-6 text-center shadow-[0_6px_20px_rgba(63,62,68,.06)] sm:p-8">
          <Icon
            className={`mx-auto h-10 w-10 text-[var(--brand-teal)] ${
              state === "loading" ? "animate-spin" : ""
            }`}
            aria-hidden="true"
          />
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[var(--brand-ink)]">
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
                className="mt-1 h-12 rounded-[14px] border-[var(--brand-line)] bg-[var(--brand-ivory)] text-base focus-visible:ring-[var(--brand-teal)]"
              />
              <Button
                type="submit"
                className="mt-4 h-12 w-full rounded-full bg-[var(--brand-teal)] text-base font-extrabold text-white shadow-[0_6px_16px_rgba(42,123,134,.28)] hover:bg-[var(--brand-teal-hover)]"
              >
                Send verification link
              </Button>
            </form>
          )}
          {verificationHref && (
            <Link
              href={verificationHref}
              className="mt-4 block text-sm font-extrabold text-[var(--brand-teal)] hover:underline"
            >
              Open development verification link
            </Link>
          )}
          <Link
            href="/auth"
            className="mt-6 inline-block text-sm font-extrabold text-[var(--brand-teal)] hover:underline"
          >
            {state === "verified" ? "Continue to sign in" : "Return to account access"}
          </Link>
        </div>
      </section>
    </div>
  );
}
