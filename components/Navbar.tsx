"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "@/components/BrandMark";
import { clsx } from "clsx";
import { Menu, ShieldCheck } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Browse" },
  { href: "/compare", label: "Compare" },
  { href: "/messages", label: "Messages" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--brand-line)] bg-[rgba(255,248,236,0.92)] backdrop-blur-xl">
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
                    "rounded-lg px-3 py-2 text-sm font-bold transition-colors",
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
            <Link href="/admin?admin=true">
              <Button variant="ghost" className="h-10 rounded-lg text-[var(--brand-muted)] hover:text-[var(--brand-ink)]">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify
              </Button>
            </Link>
            <Link href="/auth">
              <Button className="h-10 rounded-lg bg-[var(--brand-leaf)] px-4 font-extrabold text-white hover:bg-[var(--brand-ink)]">
                Join the network
              </Button>
            </Link>
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
            <SheetContent side="right" className="w-80 bg-[var(--brand-ivory)] pt-8">
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
                        "rounded-lg px-4 py-3 text-base font-bold transition-colors",
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
                <Link href="/admin?admin=true" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full rounded-lg border-[var(--brand-line)] bg-white text-[var(--brand-ink)]">
                    Verification desk
                  </Button>
                </Link>
                <Link href="/auth" onClick={() => setOpen(false)}>
                  <Button className="w-full rounded-lg bg-[var(--brand-leaf)] font-extrabold text-white hover:bg-[var(--brand-ink)]">
                    Join the network
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
