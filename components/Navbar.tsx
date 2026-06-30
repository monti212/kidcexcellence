"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "@/components/BrandMark";
import { usePlatformSession } from "@/lib/use-platform-session";
import { clsx } from "clsx";
import { LogOut, Menu, ShieldCheck, UserCircle } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Browse" },
  { href: "/compare", label: "Compare" },
  { href: "/messages", label: "Messages" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, loading, logout } = usePlatformSession();
  const profileHref =
    user?.role === "provider"
      ? "/profile/provider"
      : user?.role === "admin"
        ? "/admin"
        : "/profile/parent";

  const handleLogout = async () => {
    await logout();
    setOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--brand-line)] bg-[rgba(251,251,248,0.82)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="shrink-0" aria-label="Kidcexcellence home">
            <BrandMark />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-[var(--brand-ink)] text-white"
                      : "text-[var(--brand-muted)] hover:bg-white hover:text-[var(--brand-ink)]"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="/safety">
              <Button variant="ghost" className="h-10 rounded-full text-[var(--brand-muted)] hover:text-[var(--brand-ink)]">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Safety
              </Button>
            </Link>
            {user ? (
              <>
                <Link href={profileHref}>
                  <Button variant="outline" className="h-10 rounded-full border-[var(--brand-line)] bg-white px-3 font-extrabold text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]">
                    <UserCircle className="mr-2 h-4 w-4" />
                    {user.name}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="h-10 rounded-full px-3 text-[var(--brand-muted)] hover:text-[var(--brand-ink)]"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Link href="/auth">
                <Button className="h-10 rounded-full bg-[var(--brand-ink)] px-4 font-extrabold text-white hover:bg-[var(--brand-sky)]" disabled={loading}>
                  Join the network
                </Button>
              </Link>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="md:hidden"
              render={
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-white text-[var(--brand-ink)]" />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-[var(--brand-paper)] pt-8">
              <div className="mb-8">
                <BrandMark />
              </div>
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={clsx(
                        "rounded-2xl px-4 py-3 text-base font-semibold transition-colors",
                        active
                          ? "bg-[var(--brand-ink)] text-white"
                          : "bg-white text-[var(--brand-muted)] hover:text-[var(--brand-ink)]"
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-8 grid gap-3">
                <Link href="/safety" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full rounded-full border-[var(--brand-line)] bg-white text-[var(--brand-ink)]">
                    Safety guidance
                  </Button>
                </Link>
                {user?.role === "admin" && (
                  <Link href="/admin" onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full rounded-full border-[var(--brand-line)] bg-white text-[var(--brand-ink)]">
                      Verification desk
                    </Button>
                  </Link>
                )}
                {user ? (
                  <>
                    <Link href={profileHref} onClick={() => setOpen(false)}>
                      <Button variant="outline" className="w-full rounded-full border-[var(--brand-line)] bg-white text-[var(--brand-ink)]">
                        {user.name}
                      </Button>
                    </Link>
                    <Button onClick={handleLogout} variant="ghost" className="w-full rounded-full text-[var(--brand-muted)]">
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Link href="/auth" onClick={() => setOpen(false)}>
                    <Button className="w-full rounded-full bg-[var(--brand-ink)] font-extrabold text-white hover:bg-[var(--brand-sky)]" disabled={loading}>
                      Join the network
                    </Button>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
