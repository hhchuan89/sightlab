import type { Locale } from "./request";

/**
 * A bilingual content field: { en, zh }. Numbers stay language-neutral and live
 * outside this shape (see PLAN §5.1). `pick` selects the active locale's prose.
 */
export type Bilingual = { en: string; zh: string };

/**
 * Select the active-locale string from a bilingual field.
 * If the requested locale is missing/empty (EN-soft-fail per §14-C1), fall back
 * to the other language so the dispatch is never blank.
 */
export function pick(b: Bilingual, locale: Locale): string {
  const primary = b[locale];
  if (primary && primary.trim().length > 0) return primary;
  const fallback = locale === "en" ? b.zh : b.en;
  return fallback ?? "";
}
