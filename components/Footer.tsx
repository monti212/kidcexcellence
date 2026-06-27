"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/messages") return null;

  return (
    <footer className="mt-auto border-t border-[var(--brand-line)] bg-[var(--brand-ink)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="[&_*]:text-white">
              <BrandMark />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/68">
              A Botswana-first childcare marketplace for discovering, comparing,
              messaging, and verifying trusted care providers.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-gold)]">
              Marketplace
            </h4>
            <ul className="space-y-2 text-sm text-white/72">
              <li><Link href="/search" className="hover:text-white">Browse providers</Link></li>
              <li><Link href="/compare" className="hover:text-white">Compare options</Link></li>
              <li><Link href="/messages" className="hover:text-white">Messages</Link></li>
              <li><Link href="/auth" className="hover:text-white">Create account</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-gold)]">
              Providers
            </h4>
            <ul className="space-y-2 text-sm text-white/72">
              <li><Link href="/auth" className="hover:text-white">List a service</Link></li>
              <li><Link href="/safety" className="hover:text-white">Verification standard</Link></li>
              <li><Link href="/search?category=schools" className="hover:text-white">Schools</Link></li>
              <li><Link href="/search?category=nannies" className="hover:text-white">Nannies</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-gold)]">
              Trust
            </h4>
            <ul className="space-y-2 text-sm text-white/72">
              <li><Link href="/safety" className="hover:text-white">Safety checks</Link></li>
              <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
              <li><Link href="/terms" className="hover:text-white">Terms of service</Link></li>
              <li><Link href="/help" className="hover:text-white">Help centre</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Kidcexcellence. All rights reserved.</p>
          <p>Built for Botswana families and trusted local providers.</p>
        </div>
      </div>
    </footer>
  );
}
