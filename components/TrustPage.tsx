import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface TrustSection {
  title: string;
  body?: string;
  items?: string[];
}

export function TrustPage({
  eyebrow,
  title,
  introduction,
  icon,
  sections,
  updated,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  icon: ReactNode;
  sections: TrustSection[];
  updated?: string;
}) {
  return (
    <div className="brand-page min-h-screen">
      <header className="border-b border-[var(--brand-line)] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-black text-[var(--brand-leaf)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Kidcexcellence
          </Link>
          <div className="mt-8 flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--brand-ink)] text-[var(--brand-gold)]">
              {icon}
            </div>
            <div>
              <p className="brand-label">{eyebrow}</p>
              <h1 className="mt-2 text-4xl font-black text-[var(--brand-ink)] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--brand-muted)]">
                {introduction}
              </p>
              {updated && (
                <p className="mt-3 text-xs font-bold text-[var(--brand-muted)]">
                  Last updated {updated}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="divide-y divide-[var(--brand-line)] border-y border-[var(--brand-line)]">
          {sections.map((section) => (
            <section key={section.title} className="py-7">
              <div className="grid gap-3 md:grid-cols-[220px_1fr] md:gap-10">
                <h2 className="text-lg font-black text-[var(--brand-ink)]">
                  {section.title}
                </h2>
                <div className="text-sm leading-7 text-[var(--brand-muted)]">
                  {section.body && <p>{section.body}</p>}
                  {section.items && (
                    <ul className="space-y-2">
                      {section.items.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span
                            className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-leaf)]"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/help" className="brand-button">
            Visit help centre
          </Link>
          <Link href="/search" className="brand-button-secondary">
            Browse providers
          </Link>
        </div>
      </main>
    </div>
  );
}
