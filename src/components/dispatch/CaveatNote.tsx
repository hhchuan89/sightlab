import { CAVEAT } from "@/lib/content/caveat";
import { pick } from "@/lib/i18n/pick";
import type { Locale } from "@/lib/i18n/request";

/**
 * Renders the hardcoded model-limitation caveat (PLAN §11, §5.1). Identical
 * every day — it is the "confirmer, not predictor" framing the whole product
 * rests on. Shown on every dispatch render (site and email).
 */
export function CaveatNote({ locale, label }: { locale: Locale; label: string }) {
  return (
    <aside className="rounded-md border border-dashed border-border bg-surface/40 p-4 prose-measure">
      <span className="label-mono text-muted">{label}</span>
      <p className="mt-2 font-body text-md leading-relaxed text-text-2">{pick(CAVEAT, locale)}</p>
    </aside>
  );
}
