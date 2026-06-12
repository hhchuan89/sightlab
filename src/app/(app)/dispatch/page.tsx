import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLatest } from "@/lib/dispatch/queries";
import { DispatchArticle } from "@/components/dispatch/DispatchArticle";

// Always render fresh: this page must reflect the latest published row and the
// staleness check compares against the server clock (PLAN §14-C7).
export const dynamic = "force-dynamic";

/**
 * /dispatch — render the LATEST published dispatch in place (PLAN §15.1). If
 * nothing has been published yet, fall back to the landing page.
 *
 * Staleness banner: the producer targets one edition per UTC day, so a latest
 * edition dated YESTERDAY is normal until today's run lands. Anything OLDER
 * than yesterday (UTC) means at least one run was missed — say so above the
 * masthead instead of silently presenting an old edition as current.
 */
export default async function DispatchIndexPage() {
  const latest = await getLatest();
  if (!latest) redirect("/");

  const t = await getTranslations("dispatch");
  const yesterdayUtc = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const isStale = latest.dispatch_date < yesterdayUtc;

  return (
    <>
      {isStale ? (
        <div
          role="status"
          className="mb-6 rounded-md border border-border bg-surface-2 px-4 py-2.5 text-sm text-text-2"
        >
          {t("staleBanner", { date: latest.dispatch_date })}
        </div>
      ) : null}
      <DispatchArticle dispatch={latest} />
    </>
  );
}
