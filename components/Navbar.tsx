"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, X, Star } from "lucide-react";
import { clsx } from "clsx";

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
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #F9A8D4)" }}>
              <Star className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="text-xl font-bold" style={{ color: "#7C3AED" }}>
              Kidcexcellence
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "text-white"
                    : "text-gray-600 hover:text-purple-700 hover:bg-purple-50"
                )}
                style={
                  pathname === link.href
                    ? { background: "#7C3AED" }
                    : {}
                }
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth">
              <Button variant="ghost" className="text-gray-600 hover:text-purple-700">
                Login
              </Button>
            </Link>
            <Link href="/auth">
              <Button
                className="rounded-xl text-white font-semibold shadow-sm hover:shadow-md transition-shadow"
                style={{ background: "#7C3AED" }}
              >
                Sign Up
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="md:hidden" render={<button className="inline-flex items-center justify-center rounded-xl p-2 text-gray-600 hover:bg-gray-100 transition-colors" />}>
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 pt-10">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #F9A8D4)" }}>
                  <Star className="w-4 h-4 text-white fill-white" />
                </div>
                <span className="text-xl font-bold" style={{ color: "#7C3AED" }}>
                  Kidcexcellence
                </span>
              </div>
              <div className="flex flex-col gap-2 mb-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "px-4 py-3 rounded-xl text-base font-medium transition-colors",
                      pathname === link.href
                        ? "text-white"
                        : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                    )}
                    style={
                      pathname === link.href
                        ? { background: "#7C3AED" }
                        : {}
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/auth" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full rounded-xl border-purple-200 text-purple-700">
                    Login
                  </Button>
                </Link>
                <Link href="/auth" onClick={() => setOpen(false)}>
                  <Button className="w-full rounded-xl text-white" style={{ background: "#7C3AED" }}>
                    Sign Up
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
