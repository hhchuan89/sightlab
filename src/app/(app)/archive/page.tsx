import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/request";
import { pick } from "@/lib/i18n/pick";
import { listHistory } from "@/lib/dispatch/queries";

/**
 * /archive — PUBLIC history list (PLAN §15.1). v3 OPEN/FREE pivot: the full
 * archive is open to everyone (anon + authenticated). `list_dispatches_public`
 * returns all published rows; no paid gate, no upsell.
 */

// Caching not security-critical now (content is public), but harmless.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ArchivePage() {
  const locale = await resolveLocale();
  const t = await getTranslations("archive");
  // p_limit 365 ≈ one year of daily editions; pagination deferred until the
  // archive actually outgrows a single page.
  const rows = await listHistory(365);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <span className="article-tag">{`// ${t("tag")}`}</span>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-text">{t("emptyHeading")}</h1>
        <p className="mt-3 leading-relaxed text-text-2">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <span className="article-tag">{`// ${t("tag")}`}</span>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-text">{t("title")}</h1>
      <hr className="rule-ink mt-3" />

      <ul className="mt-2">
        {rows.map((row) => {
          const summary = pick({ en: row.intro_en ?? "", zh: row.intro_zh ?? "" }, locale);
          return (
            <li key={row.dispatch_date} className="border-b border-dashed border-border py-4">
              <Link href={`/dispatch/${row.dispatch_date}`} className="group flex flex-col gap-1">
                <span className="label-mono text-muted group-hover:text-accent">
                  {row.dispatch_date}
                </span>
                {summary ? (
                  <span className="leading-relaxed text-text-2 group-hover:text-text">
                    {summary}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
