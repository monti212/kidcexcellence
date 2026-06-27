import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  allProvidersFromStore,
  getCategoryById,
  getCategoryIcon,
} from "@/lib/platform-service";
import { readStore } from "@/lib/platform-store";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await readStore();
  const provider = allProvidersFromStore(store).find((item) => item.id === id);
  if (!provider) notFound();

  const category = getCategoryById(provider.category);
  const categoryIcon = getCategoryIcon(provider.category);
  const gallery = [
    ["Learning rooms", "Warm, supervised activity spaces"],
    ["Care routine", "Daily structure and parent updates"],
    ["Safety checks", "Documents and verification status"],
    ["Family visits", "Schedule visits before booking"],
  ];

  return (
    <div className="brand-page min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/search" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[var(--brand-leaf)]">
          <ArrowLeft className="h-4 w-4" />
          Back to providers
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <main className="space-y-6">
            <section className="brand-card overflow-hidden">
              <div className="relative h-64 overflow-hidden bg-[linear-gradient(135deg,#f7ead5,#e8f3eb)] sm:h-80">
                <div className="absolute right-8 top-8 grid h-36 w-36 place-items-center rounded-full border-8 border-white/70 bg-white/40 text-7xl shadow-sm">
                  {categoryIcon}
                </div>
                <div className="absolute bottom-8 right-56 hidden h-16 w-16 rounded-lg bg-[var(--brand-gold)]/70 sm:block" />
                <div className="absolute right-24 top-40 hidden h-20 w-20 rounded-lg bg-[var(--brand-leaf)]/15 sm:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-ink)]/82 via-[var(--brand-ink)]/24 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge className="rounded-md border-0 bg-[var(--brand-gold)] text-[var(--brand-ink)]">
                      {category?.icon} {category?.name}
                    </Badge>
                    {provider.verified && (
                      <Badge className="rounded-md border-0 bg-white text-[var(--brand-leaf)]">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-4xl font-black leading-none">{provider.name}</h1>
                  <p className="mt-2 flex items-center gap-2 text-sm text-white/80">
                    <MapPin className="h-4 w-4" />
                    {provider.location}
                  </p>
                </div>
              </div>
            </section>

            <section className="brand-card p-6">
              <h2 className="text-2xl font-black text-[var(--brand-ink)]">About this provider</h2>
              <p className="mt-3 leading-7 text-[var(--brand-muted)]">{provider.bio}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  [Star, `${provider.rating} rating`, `${provider.reviewCount} parent reviews`],
                  [CalendarDays, "Availability", provider.availability],
                  [ShieldCheck, "Experience", provider.experience],
                ].map(([Icon, title, body]) => {
                  const TypedIcon = Icon as typeof Star;
                  return (
                    <div key={title as string} className="rounded-lg border border-[var(--brand-line)] bg-[var(--brand-ivory)] p-4">
                      <TypedIcon className="mb-3 h-5 w-5 text-[var(--brand-leaf)]" />
                      <div className="text-sm font-black text-[var(--brand-ink)]">{title as string}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--brand-muted)]">{body as string}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="brand-card p-6">
              <h2 className="text-2xl font-black text-[var(--brand-ink)]">Services</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {provider.services.map((service) => (
                  <span key={service} className="rounded-md bg-[var(--brand-ivory)] px-3 py-2 text-sm font-bold text-[var(--brand-muted)]">
                    {service}
                  </span>
                ))}
              </div>
            </section>

            {provider.fees && (
              <section className="brand-card p-6">
                <h2 className="text-2xl font-black text-[var(--brand-ink)]">Fee structure</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--brand-line)] text-left text-[var(--brand-muted)]">
                        <th className="py-3 pr-4 font-black">Program</th>
                        <th className="py-3 pr-4 font-black">Termly</th>
                        <th className="py-3 font-black">Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.fees.map((fee) => (
                        <tr key={fee.grade} className="border-b border-[var(--brand-line)] last:border-0">
                          <td className="py-3 pr-4 font-bold text-[var(--brand-ink)]">{fee.grade}</td>
                          <td className="py-3 pr-4 text-[var(--brand-muted)]">P {fee.termly.toLocaleString()}</td>
                          <td className="py-3 text-[var(--brand-muted)]">P {fee.annually.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </main>

          <aside className="space-y-6">
            <section className="brand-card sticky top-24 p-5">
              <div className="text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-leaf)]">
                Contact provider
              </div>
              <div className="mt-3 text-3xl font-black text-[var(--brand-ink)]">
                P {provider.price.toLocaleString()}
                <span className="text-sm text-[var(--brand-muted)]"> /{provider.priceUnit}</span>
              </div>
              <div className="mt-5 grid gap-2">
                <Link href={`/messages?provider=${provider.id}`}>
                  <Button className="w-full rounded-lg bg-[var(--brand-leaf)] font-black text-white hover:bg-[var(--brand-ink)]">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Message in app
                  </Button>
                </Link>
                <a href={`tel:${provider.phone.replace(/\s/g, "")}`}>
                  <Button variant="outline" className="w-full rounded-lg border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
                    <Phone className="mr-2 h-4 w-4" />
                    {provider.phone}
                  </Button>
                </a>
                <a href={`mailto:${provider.email}`}>
                  <Button variant="outline" className="w-full rounded-lg border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
                    <Mail className="mr-2 h-4 w-4" />
                    Email provider
                  </Button>
                </a>
                <a href={`https://wa.me/${provider.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full rounded-lg border-[var(--brand-line)] bg-white font-black text-[var(--brand-ink)]">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
              </div>
              <div className="mt-5 rounded-lg bg-[var(--brand-ivory)] p-4 text-sm leading-6 text-[var(--brand-muted)]">
                Kidcexcellence recommends confirming references, visit times,
                fees, and child safety policies before booking.
              </div>
            </section>

            <section className="brand-card p-5">
              <h2 className="font-black text-[var(--brand-ink)]">Gallery</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {gallery.map(([title, body], index) => (
                  <div key={title} className="flex aspect-square flex-col justify-between rounded-lg bg-[var(--brand-ivory)] p-4">
                    <div className="text-3xl">{index === 0 ? categoryIcon : ["🧩", "🛡️", "📅"][index - 1]}</div>
                    <div>
                      <div className="text-sm font-black text-[var(--brand-ink)]">{title}</div>
                      <div className="mt-1 text-xs leading-4 text-[var(--brand-muted)]">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
