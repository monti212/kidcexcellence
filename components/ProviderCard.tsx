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
  schools: "bg-[rgba(84,178,191,0.16)] text-[var(--brand-sky)]",
  nurseries: "bg-[rgba(255,204,47,0.24)] text-[#8a6500]",
  nannies: "bg-[rgba(240,90,60,0.14)] text-[var(--brand-coral)]",
  helpers: "bg-[rgba(84,178,191,0.16)] text-[var(--brand-sky)]",
  babysitters: "bg-[rgba(255,204,47,0.24)] text-[#8a6500]",
  "kiddies-transport": "bg-[rgba(84,178,191,0.16)] text-[var(--brand-sky)]",
  "pediatric-clinics": "bg-[rgba(84,178,191,0.16)] text-[var(--brand-sky)]",
  tutors: "bg-[rgba(240,90,60,0.14)] text-[var(--brand-coral)]",
};

export default function ProviderCard({ provider, onAddToCompare, inCompare }: ProviderCardProps) {
  const categoryIcon = getCategoryIcon(provider.category);
  const hasPrice = provider.price > 0;
  const filledStars = Math.round(provider.rating);

  return (
    <article className="brand-card flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-44 overflow-hidden bg-[var(--brand-ivory)]">
        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(84,178,191,0.22),_transparent_38%),linear-gradient(180deg,#ffffff_0%,#f4fbfc_100%)]">
          <div className="grid h-24 w-24 place-items-center rounded-[2rem] border border-white bg-white text-5xl shadow-sm">
            {categoryIcon}
          </div>
        </div>
        <div className="absolute left-3 top-3">
          <Badge className={`rounded-md border-0 text-xs font-black ${categoryStyles[provider.category] ?? "bg-white text-[var(--brand-ink)]"}`}>
            {getCategoryLabel(provider.category)}
          </Badge>
        </div>
        {provider.verified && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[var(--brand-sky)] shadow-sm">
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
          <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-extrabold text-[var(--brand-ink)]">
            <div className="flex" aria-label={`${provider.rating} out of 5 rating`}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={`h-3.5 w-3.5 ${
                    index < filledStars
                      ? "fill-[var(--brand-gold)] text-[var(--brand-gold)]"
                      : "text-[var(--brand-line)]"
                  }`}
                />
              ))}
            </div>
            <span>{provider.rating || "New"}</span>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-1.5 text-sm text-[var(--brand-muted)]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--brand-coral)]" />
          <span className="truncate">{provider.location}</span>
          <span className="text-xs">
            {provider.reviewCount ? `(${provider.reviewCount} reviews)` : "(No reviews yet)"}
          </span>
        </div>

        <p className="mb-4 line-clamp-2 text-sm leading-6 text-[var(--brand-muted)]">
          {provider.bio}
        </p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {provider.services.slice(0, 3).map((service) => (
            <span key={service} className="rounded-full bg-[var(--brand-cream)] px-2.5 py-1 text-xs font-bold text-[var(--brand-muted)]">
              {service}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--brand-line)] pt-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-muted)]">
              {hasPrice ? "From" : "Pricing"}
            </div>
            <div className="text-lg font-black text-[var(--brand-ink)]">
              {hasPrice ? (
                <>
                  P {provider.price.toLocaleString()}
                  <span className="text-xs font-bold text-[var(--brand-muted)]"> /{provider.priceUnit}</span>
                </>
              ) : (
                <span className="text-sm">Contact for pricing</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {onAddToCompare && (
              <Button
                variant="outline"
                size="sm"
                className={`h-9 rounded-full border-[var(--brand-line)] px-3 text-xs font-black ${
                  inCompare ? "bg-[var(--brand-gold)] text-[var(--brand-ink)]" : "bg-white text-[var(--brand-ink)]"
                }`}
                onClick={() => onAddToCompare(provider.id)}
              >
                {inCompare ? "Added" : "Compare"}
              </Button>
            )}
            <Link href={`/provider/${provider.id}`}>
              <Button size="sm" className="h-9 rounded-full bg-[var(--brand-sky)] px-3 text-xs font-black text-white hover:bg-[var(--brand-coral)]">
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
