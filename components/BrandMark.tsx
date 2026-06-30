import Image from "next/image";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center">
      <Image
        src="/kidcellence-logo.png"
        alt="Kidcellence"
        width={compact ? 164 : 274}
        height={compact ? 32 : 54}
        priority
        className={compact ? "h-8 w-auto" : "h-11 w-auto"}
      />
    </div>
  );
}
