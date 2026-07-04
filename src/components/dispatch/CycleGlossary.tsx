import { getTranslations } from "next-intl/server";

/**
 * Permanent cycle-terms glossary, fixed at the foot of every dispatch (PLAN §15.1).
 * Explains the §7 table vocabulary — Weinstein stage, distance-from-30-week-SMA,
 * slope, sector dispersion — plus the §6 accumulation/distribution labels, so a
 * first-time reader can decode the tables without leaving the page.
 *
 * Static reference content: no data, no holdings, market-only and identical every
 * day. Rendered as the article's closing appendix, below the caveat.
 */
const TERMS = [
  "ladders",
  "stage",
  "distance",
  "slope",
  "dispersion",
  "flows",
  "volume",
  "confidence",
] as const;

export async function CycleGlossary() {
  const t = await getTranslations("dispatch");

  return (
    <section
      aria-labelledby="glossary-heading"
      className="mt-12 border-t border-border pt-8 prose-measure"
    >
      <span className="article-tag">
        {"// "}
        {t("glossary.tag")}
      </span>
      <h2 id="glossary-heading" className="mt-2 font-serif text-xl font-semibold text-text">
        {t("glossary.title")}
      </h2>
      <p className="mt-2 font-body text-md leading-relaxed text-text">{t("glossary.intro")}</p>

      <dl className="mt-6 space-y-5">
        {TERMS.map((k) => (
          <div key={k} className="border-l border-border pl-4">
            <dt className="label-mono text-text">{t(`glossary.${k}.term`)}</dt>
            <dd className="mt-1.5 font-body text-md leading-relaxed text-text">
              {t(`glossary.${k}.def`)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
