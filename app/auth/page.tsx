"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Eye, EyeOff, Baby, Briefcase } from "lucide-react";
import { clearLegacyPlatformSession, notifyPlatformSessionChanged } from "@/lib/use-platform-session";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(false);
  const [parentLocation, setParentLocation] = useState("");
  const [providerCategory, setProviderCategory] = useState("");
  const [providerLocation, setProviderLocation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const completeAuth = async (role: "parent" | "provider" | "login", formData: FormData) => {
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
        location: nextRole === "provider" ? providerLocation : parentLocation,
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
        ? "Provider account created. Opening your listing workspace..."
        : role === "parent"
          ? "Parent account created. Opening your family profile..."
          : "Welcome back. Opening your parent workspace..."
    );
    window.setTimeout(() => {
      router.push(session.role === "provider" ? "/profile/provider" : "/profile/parent");
    }, 600);
  };

  return (
    <div className="brand-page flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex justify-center">
            <BrandMark />
          </Link>
          <p className="mt-3 text-sm font-bold text-[var(--brand-muted)]">
            Join the childcare network trusted across Botswana
          </p>
        </div>

        <div className="brand-card p-8">
          {/* Auth Mode Toggle */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              onClick={() => setIsLogin(false)}
              className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${
                !isLogin
                  ? "bg-[var(--brand-leaf)] text-white shadow-sm"
                  : "text-[var(--brand-muted)] hover:text-[var(--brand-ink)]"
              }`}
            >
              Create Account
            </button>
            <button
              onClick={() => setIsLogin(true)}
              className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${
                isLogin
                  ? "bg-[var(--brand-leaf)] text-white shadow-sm"
                  : "text-[var(--brand-muted)] hover:text-[var(--brand-ink)]"
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
            />
          ) : (
            <SignupForm
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
            <div className="mt-5 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] px-4 py-3 text-sm font-bold text-[var(--brand-leaf)]">
              {statusMessage}
            </div>
          )}

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--brand-line)]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-[var(--brand-muted)]">or continue with</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-4 flex w-full items-center gap-3 rounded-lg border-[var(--brand-line)] text-[var(--brand-ink)] hover:bg-[var(--brand-ivory)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          </div>

          <p className="mt-5 text-center text-sm text-[var(--brand-muted)]">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-black text-[var(--brand-leaf)] hover:underline"
            >
              {isLogin ? "Sign up" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  showPassword,
  setShowPassword,
  onComplete,
}: {
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onComplete: (formData: FormData) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onComplete(new FormData(event.currentTarget)); }}>
      <div>
        <Label htmlFor="email" className="text-[var(--brand-ink)] font-medium text-sm">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your@email.com"
          className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]"
        />
      </div>
      <div>
        <Label htmlFor="password" className="text-[var(--brand-ink)] font-medium text-sm">Password</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-right mt-1">
          <button type="button" className="text-xs text-[var(--brand-leaf)] hover:underline">
            Forgot password?
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className="mt-2 h-11 w-full rounded-lg bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-ink)]"
         
      >
        Login
      </Button>
    </form>
  );
}

function SignupForm({
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
  onComplete: (role: "parent" | "provider", formData: FormData) => void;
}) {
  return (
    <Tabs defaultValue="parent">
      <TabsList className="grid w-full grid-cols-2 mb-6 rounded-lg bg-[var(--brand-ivory)]">
        <TabsTrigger value="parent" className="rounded-lg flex items-center gap-2 data-[state=active]:bg-white">
          <Baby className="w-4 h-4" />
          I&apos;m a Parent
        </TabsTrigger>
        <TabsTrigger value="provider" className="rounded-lg flex items-center gap-2 data-[state=active]:bg-white">
          <Briefcase className="w-4 h-4" />
          I&apos;m a Provider
        </TabsTrigger>
      </TabsList>

      <TabsContent value="parent">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onComplete("parent", new FormData(event.currentTarget)); }}>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Full Name</Label>
            <Input name="name" placeholder="Mpho Dlamini" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Email</Label>
            <Input name="email" type="email" placeholder="your@email.com" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Phone Number</Label>
            <Input name="phone" placeholder="+267 71 234 567" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Location</Label>
            <Select value={parentLocation} onValueChange={(value) => setParentLocation(value ?? "")}>
              <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gaborone">Gaborone</SelectItem>
                <SelectItem value="francistown">Francistown</SelectItem>
                <SelectItem value="maun">Maun</SelectItem>
                <SelectItem value="kasane">Kasane</SelectItem>
                <SelectItem value="lobatse">Lobatse</SelectItem>
                <SelectItem value="serowe">Serowe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Password</Label>
            <div className="relative mt-1">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className="rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Confirm Password</Label>
            <div className="relative mt-1">
              <Input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat password"
                className="rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] pr-10"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="mt-2 h-11 w-full rounded-lg bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-ink)]"  >
            Create Parent Account
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="provider">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onComplete("provider", new FormData(event.currentTarget)); }}>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Business / Full Name</Label>
            <Input name="name" placeholder="Sunshine ELC or Your Name" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Category</Label>
            <Select value={providerCategory} onValueChange={(value) => setProviderCategory(value ?? "")}>
              <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="schools">School</SelectItem>
                <SelectItem value="nurseries">Nursery</SelectItem>
                <SelectItem value="nannies">Nanny</SelectItem>
                <SelectItem value="babysitters">Babysitter</SelectItem>
                <SelectItem value="pediatric-clinics">Pediatric Clinic</SelectItem>
                <SelectItem value="tutors">Tutor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Email</Label>
            <Input name="email" type="email" placeholder="your@email.com" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Phone / WhatsApp</Label>
            <Input name="phone" placeholder="+267 71 234 567" className="mt-1 rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)]" />
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Location</Label>
            <Select value={providerLocation} onValueChange={(value) => setProviderLocation(value ?? "")}>
              <SelectTrigger className="mt-1 rounded-lg border-[var(--brand-line)]">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gaborone">Gaborone</SelectItem>
                <SelectItem value="francistown">Francistown</SelectItem>
                <SelectItem value="maun">Maun</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[var(--brand-ink)] font-medium text-sm">Password</Label>
            <div className="relative mt-1">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className="rounded-lg border-[var(--brand-line)] focus-visible:ring-[var(--brand-leaf)] pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="mt-2 h-11 w-full rounded-lg bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-ink)]"  >
            Create Provider Account
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
