"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandMark } from "@/components/BrandMark";
import { Eye, EyeOff, Baby, Briefcase, ShieldCheck } from "lucide-react";
import { PROVIDER_CATEGORY_OPTIONS } from "@/lib/mock-data";
import { BOTSWANA_LOCATIONS } from "@/lib/botswana-locations";
import { clearLegacyPlatformSession, notifyPlatformSessionChanged } from "@/lib/use-platform-session";

type SignupRole = "parent" | "provider" | "admin";

function safeNextPath(next: string | null, role: "parent" | "provider" | "admin") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return role === "provider" ? "/profile/provider" : role === "admin" ? "/admin" : "/profile/parent";
  }

  if (role === "provider" && next.startsWith("/profile/provider")) return next;
  if (role === "parent" && next.startsWith("/profile/parent")) return next;
  if (role === "admin" && next.startsWith("/admin")) return next;

  return role === "provider" ? "/profile/provider" : role === "admin" ? "/admin" : "/profile/parent";
}

// Design styles: fields, labels and buttons from the Kidcellence screens.
const FIELD_BASE =
  "h-12 rounded-[14px] border-[var(--brand-line)] bg-[var(--brand-ivory)] px-3.5 text-base font-medium text-[var(--brand-ink)] focus-visible:ring-[var(--brand-teal)]";
const FIELD = `mt-1.5 ${FIELD_BASE}`;
const LABEL = "text-sm font-bold text-[var(--brand-ink)]";
const SUBMIT =
  "mt-2 h-12 w-full rounded-full bg-[var(--brand-teal)] text-base font-extrabold text-white shadow-[0_6px_16px_rgba(42,123,134,.28)] hover:bg-[var(--brand-teal-hover)]";
const EYE =
  "absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--brand-muted)] hover:text-[var(--brand-ink)]";
const ROLE_TAB =
  "flex min-h-10 items-center gap-2 rounded-full text-sm font-bold text-[var(--brand-ink)] data-active:bg-[var(--brand-teal)] data-active:text-white";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--brand-ivory)] text-sm font-bold text-[var(--brand-muted)]">Loading account access...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "login";
  const requestedRole = searchParams.get("role");
  const initialSignupRole: SignupRole =
    requestedRole === "provider" ? "provider" : requestedRole === "admin" ? "admin" : "parent";
  const requestedProviderCategory = searchParams.get("category") ?? "";
  const [isLogin, setIsLogin] = useState(initialMode);
  const [parentLocation, setParentLocation] = useState("");
  const [providerCategory, setProviderCategory] = useState(requestedProviderCategory);
  const [providerLocation, setProviderLocation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [lifecycleMessage, setLifecycleMessage] = useState("");
  const [lifecycleHref, setLifecycleHref] = useState("");

  useEffect(() => {
    setIsLogin(searchParams.get("mode") === "login");
  }, [searchParams]);

  useEffect(() => {
    const nextProviderCategory = searchParams.get("category");
    if (nextProviderCategory) setProviderCategory(nextProviderCategory);
  }, [searchParams]);

  const completeAuth = async (role: SignupRole | "login", formData: FormData) => {
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (role !== "login" && password !== confirmPassword) {
      setStatusMessage("Passwords do not match.");
      return;
    }

    const nextRole = role === "login" ? "parent" : role;
    const response = await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: role === "login" ? "login" : "signup",
        role: nextRole,
        name: formData.get("name"),
        email: formData.get("email"),
        password,
        phone: formData.get("phone"),
        location: nextRole === "provider" ? providerLocation : nextRole === "parent" ? parentLocation : undefined,
        category: nextRole === "provider" ? providerCategory : undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatusMessage(payload.error ?? "Could not complete authentication.");
      return;
    }

    const session = payload.session;
    clearLegacyPlatformSession();
    notifyPlatformSessionChanged();
    setStatusMessage(
      session.role === "provider"
        ? "Opening your provider workspace..."
        : session.role === "admin"
          ? "Admin account ready. Opening verification dashboard..."
        : role === "parent"
          ? "Parent account created. Opening your family profile..."
          : "Welcome back. Opening your parent workspace..."
    );
    window.setTimeout(() => {
      router.push(safeNextPath(searchParams.get("next"), session.role));
    }, 600);
  };

  const requestPasswordReset = async (formData: FormData) => {
    const email = String(formData.get("email") ?? "");
    if (!email.includes("@")) {
      setLifecycleMessage("Enter your email first, then request a password reset.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setLifecycleMessage(payload.error ?? "Could not start password reset.");
      return;
    }

    setLifecycleMessage(
      payload.delivery?.token
        ? "A development reset link is ready."
        : "If an account exists for that email, reset instructions are ready."
    );
    setLifecycleHref(
      payload.delivery?.token
        ? `/auth/reset-password?token=${encodeURIComponent(payload.delivery.token)}`
        : ""
    );
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--brand-ivory)] px-4 py-10 sm:items-center sm:py-14">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex justify-center">
            <BrandMark />
          </Link>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[var(--brand-ink)]">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-[15px] font-medium text-[var(--brand-muted)]">
            Join the childcare network trusted across Botswana
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--brand-line)] bg-white p-6 shadow-[0_6px_20px_rgba(63,62,68,.06)] sm:p-8">
          {/* Auth Mode Toggle */}
          <div role="group" aria-label="Account access" className="mb-6 flex rounded-full border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-1">
            <button
              type="button"
              aria-pressed={!isLogin}
              onClick={() => setIsLogin(false)}
              className={`min-h-10 flex-1 rounded-full px-4 text-sm font-extrabold transition-colors ${
                !isLogin
                  ? "bg-[var(--brand-teal)] text-white"
                  : "text-[var(--brand-ink)] hover:text-[var(--brand-teal)]"
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              aria-pressed={isLogin}
              onClick={() => setIsLogin(true)}
              className={`min-h-10 flex-1 rounded-full px-4 text-sm font-extrabold transition-colors ${
                isLogin
                  ? "bg-[var(--brand-teal)] text-white"
                  : "text-[var(--brand-ink)] hover:text-[var(--brand-teal)]"
              }`}
            >
              Login
            </button>
          </div>

          {isLogin ? (
            <LoginForm
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              onComplete={(formData) => completeAuth("login", formData)}
              onPasswordReset={requestPasswordReset}
            />
          ) : (
            <SignupForm
              defaultRole={initialSignupRole}
              parentLocation={parentLocation}
              setParentLocation={setParentLocation}
              providerCategory={providerCategory}
              setProviderCategory={setProviderCategory}
              providerLocation={providerLocation}
              setProviderLocation={setProviderLocation}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              onComplete={completeAuth}
            />
          )}

          {statusMessage && (
            <div role="status" className="mt-5 rounded-[14px] bg-[var(--brand-ivory)] px-4 py-3 text-sm font-bold text-[var(--brand-teal)]">
              {statusMessage}
            </div>
          )}

          {lifecycleMessage && (
            <div role="status" className="mt-5 break-words rounded-[14px] border border-[var(--brand-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--brand-muted)]">
              {lifecycleMessage}
              {lifecycleHref && (
                <Link
                  href={lifecycleHref}
                  className="mt-2 block font-extrabold text-[var(--brand-teal)] hover:underline"
                >
                  Continue
                </Link>
              )}
            </div>
          )}

          <p className="mt-5 text-center text-sm text-[var(--brand-muted)]">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-extrabold text-[var(--brand-teal)] hover:underline"
            >
              {isLogin ? "Sign up" : "Login"}
            </button>
          </p>
          <Link
            href="/auth/verify-email"
            className="mt-3 block text-center text-sm font-bold text-[var(--brand-teal)] hover:underline"
          >
            Verify an email address
          </Link>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  showPassword,
  setShowPassword,
  onComplete,
  onPasswordReset,
}: {
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onComplete: (formData: FormData) => void;
  onPasswordReset: (formData: FormData) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onComplete(new FormData(event.currentTarget)); }}>
      <div>
        <Label htmlFor="email" className={LABEL}>Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your@email.com"
          className={FIELD}
        />
      </div>
      <div>
        <Label htmlFor="password" className={LABEL}>Password</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className={`${FIELD_BASE} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className={EYE}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-right mt-1">
          <button
            type="button"
            onClick={(event) => onPasswordReset(new FormData(event.currentTarget.form ?? undefined))}
            className="text-sm font-bold text-[var(--brand-teal)] hover:underline"
          >
            Forgot password?
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className={SUBMIT}
      >
        Login
      </Button>
    </form>
  );
}

function LocationAutocomplete({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <Input
        id={id}
        name="location"
        list={`${id}-options`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Start typing a place in Botswana"
        autoComplete="address-level2"
        className={FIELD}
      />
      <datalist id={`${id}-options`}>
        {BOTSWANA_LOCATIONS.map((location) => (
          <option key={location} value={location} />
        ))}
      </datalist>
    </>
  );
}

function SignupForm({
  defaultRole,
  parentLocation,
  setParentLocation,
  providerCategory,
  setProviderCategory,
  providerLocation,
  setProviderLocation,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  onComplete,
}: {
  defaultRole: SignupRole;
  parentLocation: string;
  setParentLocation: (value: string) => void;
  providerCategory: string;
  setProviderCategory: (value: string) => void;
  providerLocation: string;
  setProviderLocation: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  onComplete: (role: SignupRole, formData: FormData) => void;
}) {
  return (
    <Tabs key={defaultRole} defaultValue={defaultRole}>
      <TabsList className="mb-6 grid h-auto w-full group-data-horizontal/tabs:h-auto grid-cols-3 rounded-full border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-1">
        <TabsTrigger value="parent" className={ROLE_TAB}>
          <Baby className="w-4 h-4" />
          <span className="hidden sm:inline">I&apos;m a Parent</span>
          <span className="sm:hidden">Parent</span>
        </TabsTrigger>
        <TabsTrigger value="provider" className={ROLE_TAB}>
          <Briefcase className="w-4 h-4" />
          <span className="hidden sm:inline">I&apos;m a Provider</span>
          <span className="sm:hidden">Provider</span>
        </TabsTrigger>
        <TabsTrigger value="admin" className={ROLE_TAB}>
          <ShieldCheck className="w-4 h-4" />
          <span className="hidden sm:inline">I&apos;m an Admin</span>
          <span className="sm:hidden">Admin</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="parent">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onComplete("parent", new FormData(event.currentTarget)); }}>
          <div>
            <Label className={LABEL}>Full Name</Label>
            <Input name="name" placeholder="Mpho Dlamini" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Email</Label>
            <Input name="email" type="email" placeholder="your@email.com" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Phone Number</Label>
            <Input name="phone" placeholder="+267 71 234 567" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Location</Label>
            <LocationAutocomplete
              id="parent-location"
              value={parentLocation}
              onChange={setParentLocation}
            />
          </div>
          <div>
            <Label className={LABEL}>Password</Label>
            <div className="relative mt-1">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className={`${FIELD_BASE} pr-12`}
              />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className={EYE}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className={LABEL}>Confirm Password</Label>
            <div className="relative mt-1">
              <Input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat password"
                className={`${FIELD_BASE} pr-12`}
              />
              <button type="button" aria-label={showConfirmPassword ? "Hide password" : "Show password"} onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={EYE}>
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className={SUBMIT}>
            Create Parent Account
          </Button>
          <SignupTermsNotice />
        </form>
      </TabsContent>

      <TabsContent value="provider">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onComplete("provider", new FormData(event.currentTarget)); }}>
          <div>
            <Label className={LABEL}>Business / Full Name</Label>
            <Input name="name" placeholder="Sunshine ELC or Your Name" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Category</Label>
            <Select value={providerCategory} onValueChange={(value) => setProviderCategory(value ?? "")}>
              <SelectTrigger className="mt-1 h-12 w-full rounded-[14px] border-[var(--brand-line)] bg-[var(--brand-ivory)] text-base">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={LABEL}>Email</Label>
            <Input name="email" type="email" placeholder="your@email.com" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Phone / WhatsApp</Label>
            <Input name="phone" placeholder="+267 71 234 567" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Location</Label>
            <LocationAutocomplete
              id="provider-location"
              value={providerLocation}
              onChange={setProviderLocation}
            />
          </div>
          <div>
            <Label className={LABEL}>Password</Label>
            <div className="relative mt-1">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className={`${FIELD_BASE} pr-12`}
              />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className={EYE}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className={LABEL}>Confirm Password</Label>
            <div className="relative mt-1">
              <Input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat password"
                className={`${FIELD_BASE} pr-12`}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={EYE}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className={SUBMIT}>
            Create Provider Account
          </Button>
          <SignupTermsNotice />
        </form>
      </TabsContent>

      <TabsContent value="admin">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onComplete("admin", new FormData(event.currentTarget)); }}>
          <div>
            <Label className={LABEL}>Full Name</Label>
            <Input name="name" placeholder="Admin name" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Admin Email</Label>
            <Input name="email" type="email" placeholder="admin@email.com" className={FIELD} />
          </div>
          <div>
            <Label className={LABEL}>Password</Label>
            <div className="relative mt-1">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className={`${FIELD_BASE} pr-12`}
              />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className={EYE}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className={LABEL}>Confirm Password</Label>
            <div className="relative mt-1">
              <Input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat password"
                className={`${FIELD_BASE} pr-12`}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={EYE}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="rounded-[14px] bg-[var(--brand-ivory)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--brand-muted)]">
            Admin signup is only available for emails enabled by Kidcellence.
          </p>
          <Button type="submit" className={SUBMIT}>
            Create Admin Account
          </Button>
          <SignupTermsNotice />
        </form>
      </TabsContent>
    </Tabs>
  );
}

function SignupTermsNotice() {
  return (
    <p className="text-xs leading-5 text-[var(--brand-muted)]">
      By creating an account, you agree to the{" "}
      <Link href="/terms" className="font-bold text-[var(--brand-teal)] hover:underline">
        Terms of service
      </Link>
      . Listing fees, paid promotions, billing, cancellations, and refunds apply only when shown in
      the relevant signup or payment flow.
    </p>
  );
}
