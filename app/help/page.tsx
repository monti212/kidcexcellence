import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, KeyRound, MessagesSquare, Store, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Help Centre | Kidcexcellence",
  description: "Account, provider listing, messaging, and safety help for Kidcexcellence.",
};

const helpTopics = [
  {
    title: "Account access",
    body: "Create a parent or provider account, sign in, verify your email, or reset your password.",
    href: "/auth",
    label: "Open account access",
    icon: KeyRound,
  },
  {
    title: "Parent profile",
    body: "Keep child information in your private family workspace and update it when your needs change.",
    href: "/profile/parent",
    label: "Open parent profile",
    icon: UserRound,
  },
  {
    title: "Provider listing",
    body: "Complete public details, pricing, documents, and gallery content before publishing your listing.",
    href: "/profile/provider",
    label: "Open provider workspace",
    icon: Store,
  },
  {
    title: "Messages",
    body: "Continue provider enquiries and review existing conversations from your signed-in workspace.",
    href: "/messages",
    label: "Open messages",
    icon: MessagesSquare,
  },
];

export default function HelpPage() {
  return (
    <div className="brand-page min-h-screen">
      <header className="border-b border-[var(--brand-line)] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--brand-ink)] text-[var(--brand-gold)]">
            <CircleHelp className="h-5 w-5" />
          </div>
          <p className="brand-label mt-6">Help centre</p>
          <h1 className="mt-2 text-4xl font-black text-[var(--brand-ink)] sm:text-5xl">
            Find the right next step.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--brand-muted)]">
            Access account, profile, listing, messaging, and safety support from one place.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--brand-line)] bg-[var(--brand-line)] md:grid-cols-2">
          {helpTopics.map(({ title, body, href, label, icon: Icon }) => (
            <section key={title} className="bg-white p-6">
              <Icon className="h-5 w-5 text-[var(--brand-leaf)]" />
              <h2 className="mt-4 text-xl font-black text-[var(--brand-ink)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">{body}</p>
              <Link
                href={href}
                className="mt-5 inline-block text-sm font-black text-[var(--brand-leaf)] hover:underline"
              >
                {label}
              </Link>
            </section>
          ))}
        </div>

        <section className="mt-10 border-y border-[var(--brand-line)] py-8">
          <h2 className="text-2xl font-black text-[var(--brand-ink)]">Safety concern</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--brand-muted)]">
            For immediate danger or suspected harm, contact Botswana emergency services or the
            appropriate local authority first. For marketplace guidance, review the safety standard
            before continuing with a provider.
          </p>
          <Link href="/safety" className="brand-button mt-5">
            Review safety guidance
          </Link>
        </section>
      </main>
    </div>
  );
}
