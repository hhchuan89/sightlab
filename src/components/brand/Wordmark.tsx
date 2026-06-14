import { useTranslations } from "next-intl";
import { SightMark } from "@/components/brand/SightMark";

/**
 * SightLab wordmark — the lockup is `[two-dot mark] SightLab` (the mark IS the
 * brand dot now; there is no trailing amber period and no legacy mono variant):
 *  A) app header   — the lockup.
 *  B) marketing    — the lockup + a mono `brand.tagline` sublabel below it.
 *  C) footer       — the lockup at a smaller size.
 */

type Variant = "A" | "B" | "C";

function Lockup({ markSize, textClass }: { markSize: number; textClass: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <SightMark size={markSize} />
      <span
        className={`font-serif font-semibold leading-none tracking-tight text-text ${textClass}`}
      >
        Sight<span className="font-normal">Lab</span>
      </span>
    </span>
  );
}

export function Wordmark({
  variant = "A",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "C") {
    return (
      <span className={`inline-flex items-center ${className}`} aria-label="SightLab">
        <Lockup markSize={18} textClass="text-lg" />
      </span>
    );
  }

  if (variant === "B") {
    return <WordmarkWithTagline className={className} />;
  }

  return (
    <span className={`inline-flex items-center ${className}`} aria-label="SightLab">
      <Lockup markSize={22} textClass="text-2xl" />
    </span>
  );
}

function WordmarkWithTagline({ className }: { className: string }) {
  const t = useTranslations("brand");
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`} aria-label="SightLab">
      <Lockup markSize={22} textClass="text-2xl" />
      <span className="label-mono text-[9px] text-muted">{t("tagline")}</span>
    </span>
  );
}
