import { Sparkles } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--brand-ink)] text-[var(--brand-gold)] shadow-sm ring-1 ring-black/5">
        <Sparkles className="h-4 w-4 fill-[var(--brand-gold)]" />
      </div>
      {!compact && (
        <div className="leading-none">
          <span className="block text-lg font-black tracking-normal text-[var(--brand-ink)]">
            Kidcexcellence
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand-leaf)]">
            Botswana care network
          </span>
        </div>
      )}
    </div>
  );
}
