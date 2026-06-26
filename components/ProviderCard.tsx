import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MapPin, MessageCircle, Star } from "lucide-react";
import type { Provider } from "@/lib/mock-data";
import { getCategoryIcon, getCategoryLabel } from "@/lib/platform-service";

interface ProviderCardProps {
  provider: Provider;
  onAddToCompare?: (id: string) => void;
  inCompare?: boolean;
}

const categoryStyles: Record<string, string> = {
  schools: "bg-[#e4f0ff] text-[#285c8f]",
  nurseries: "bg-[#e5f4eb] text-[#2f7d5a]",
  nannies: "bg-[#ffe7de] text-[#a84b37]",
  babysitters: "bg-[#fff0c9] text-[#8a6118]",
  "pediatric-clinics": "bg-[#f8e3e1] text-[#9f3c34]",
  tutors: "bg-[#eee8ff] text-[#60499d]",
};

export default function ProviderCard({ provider, onAddToCompare, inCompare }: ProviderCardProps) {
  const categoryIcon = getCategoryIcon(provider.category);

  return (
    <article className="brand-card flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-44 overflow-hidden bg-[#f7ead5]">
        <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#f7ead5_0%,#e8f3eb_100%)]">
          <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-white/55 text-5xl shadow-sm">
            {categoryIcon}
          </div>
        </div>
        <div className="absolute left-3 top-3">
          <Badge className={`rounded-md border-0 text-xs font-black ${categoryStyles[provider.category] ?? "bg-white text-[var(--brand-ink)]"}`}>
            {getCategoryLabel(provider.category)}
          </Badge>
        </div>
        {provider.verified && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-black text-[var(--brand-leaf)] shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verified
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="text-base font-black leading-tight text-[var(--brand-ink)]">
            {provider.name}
          </h3>
          <div className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-[var(--brand-ink)]">
            <Star className="h-4 w-4 fill-[var(--brand-gold)] text-[var(--brand-gold)]" />
            {provider.rating}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-1.5 text-sm text-[var(--brand-muted)]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--brand-coral)]" />
          <span className="truncate">{provider.location}</span>
          <span className="text-xs">({provider.reviewCount} reviews)</span>
        </div>

        <p className="mb-4 line-clamp-2 text-sm leading-6 text-[var(--brand-muted)]">
          {provider.bio}
        </p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {provider.services.slice(0, 3).map((service) => (
            <span key={service} className="rounded-md bg-[var(--brand-ivory)] px-2 py-1 text-xs font-bold text-[var(--brand-muted)]">
              {service}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--brand-line)] pt-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-muted)]">
              From
            </div>
            <div className="text-lg font-black text-[var(--brand-ink)]">
              P {provider.price.toLocaleString()}
              <span className="text-xs font-bold text-[var(--brand-muted)]"> /{provider.priceUnit}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {onAddToCompare && (
              <Button
                variant="outline"
                size="sm"
                className={`h-9 rounded-lg border-[var(--brand-line)] px-3 text-xs font-black ${
                  inCompare ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]" : "bg-white text-[var(--brand-ink)]"
                }`}
                onClick={() => onAddToCompare(provider.id)}
              >
                {inCompare ? "Added" : "Compare"}
              </Button>
            )}
            <Link href={`/provider/${provider.id}`}>
              <Button size="sm" className="h-9 rounded-lg bg-[var(--brand-leaf)] px-3 text-xs font-black text-white hover:bg-[var(--brand-ink)]">
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                Profile
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
