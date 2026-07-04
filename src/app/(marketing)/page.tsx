import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/request";
import { pick } from "@/lib/i18n/pick";
import { getLatest } from "@/lib/dispatch/queries";
import { etfDisplayName } from "@/lib/dispatch/etfNames";
import { cyclePhaseLabel, confidenceWord } from "@/lib/dispatch/displayWords";
import type { Dispatch } from "@/lib/dispatch/types";

/**
 * Landing page. Honesty rule: real numbers only ever appear WITH their real
 * dispatch date. If a published dispatch exists, the hero/at-a-glance show ITS
 * data and ITS date; if none exists yet, the illustrative sample copy renders
 * with a visible "Sample" badge and NO current date attached.
 */

function GlanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="leader-row">
      <span className="leader-key">{label}</span>
      <span className="leader-dots" aria-hidden />
      <span className="leader-value">{value}</span>
    </div>
  );
}

function SampleBadge({ label }: { label: string }) {
  return (
    <span className="label-mono rounded-sm border border-border bg-surface-2 px-2 py-0.5 text-muted">
      {label}
    </span>
  );
}

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = await resolveLocale();

  // A read failure must not take the marketing page down — fall back to sample.
  let latest: Dispatch | null = null;
  try {
    latest = await getLatest();
  } catch (err) {
    console.error(
      `landing: getLatest failed, rendering sample: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── derive the hero + at-a-glance content (real when available) ──
  const badge = latest?.cycle_badge ?? null;
  const introText = latest
    ? pick({ en: latest.intro_en ?? "", zh: latest.intro_zh ?? "" }, locale)
    : "";
  const glanceText = latest
    ? pick({ en: latest.at_a_glance_en ?? "", zh: latest.at_a_glance_zh ?? "" }, locale)
    : "";

  let glanceRows: { label: string; value: string }[];
  if (latest) {
    const zhBySymbol = new Map(latest.flows_section6.rows.map((r) => [r.etf, r.name_zh]));
    const ranking = latest.cycle_section7.dispersion.sector_ranking;
    const leader = ranking[0];
    const laggard = ranking.length > 1 ? ranking[ranking.length - 1] : undefined;
    glanceRows = [
      ...(badge
        ? [
            {
              label: t("glanceCycleStage"),
              value: cyclePhaseLabel(
                typeof badge.templeton_stage === "string"
                  ? badge.templeton_stage
                  : pick(badge.templeton_stage, locale),
                locale,
              ),
            },
            { label: t("glanceConfidence"), value: confidenceWord(badge.confidence, locale) },
          ]
        : []),
      ...(leader
        ? [
            {
              label: t("glanceLeader"),
              value: etfDisplayName(leader, zhBySymbol.get(leader) ?? leader, locale),
            },
          ]
        : []),
      ...(laggard
        ? [
            {
              label: t("glanceLaggard"),
              value: etfDisplayName(laggard, zhBySymbol.get(laggard) ?? laggard, locale),
            },
          ]
        : []),
    ];
  } else {
    glanceRows = [
      { label: t("glanceCycleStage"), value: t("glanceCycleValue") },
      { label: t("glanceConfidence"), value: t("glanceConfidenceValue") },
      { label: t("glanceLeader"), value: t("glanceLeaderValue") },
      { label: t("glanceLaggard"), value: t("glanceLaggardValue") },
    ];
  }

  return (
    <div className="mx-auto max-w-5xl px-5">
      {/* ── masthead dispatch line: the REAL edition date, or "Sample" ── */}
      <div className="flex items-baseline justify-between gap-4 pt-10">
        <span className="article-tag">{`// ${t("dispatchNo")}`}</span>
        {latest ? (
          <span className="label-mono text-muted">
            {t("edition")} · {latest.dispatch_date}
          </span>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className="label-mono text-muted">{t("edition")}</span>
            <SampleBadge label={t("sampleBadge")} />
          </span>
        )}
      </div>
      <hr className="rule-ink mt-3" />

      {/* ── hero (audit 20260704 PR-B): H1 is a FIXED product promise — never the
             live intro. The old hero printed the whole intro sentence (57 chars +
             6 tickers) at display size, which alone ate half a phone's first
             screen and pushed the CTA below the fold. The live intro now lives in
             a dated deck BELOW the CTA, so the first screen = headline + one-line
             standfirst + button, exactly the reader's orientation set. ── */}
      <section className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[1.4fr_1fr] lg:gap-14 lg:pt-12">
        <div>
          <h1 className="text-5xl font-semibold text-text">{t("heroTitle")}</h1>
          <p className="mt-5 font-body text-lg leading-relaxed text-text prose-measure">
            {t("standfirst")}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {/* v3 open/free pivot (PLAN §15.7): the CTA opens the live dispatch —
                content is free — not a pricing page. */}
            <Link
              href="/dispatch"
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-on-primary transition-colors hover:bg-primary-hover"
            >
              {t("ctaButton")}
            </Link>
            <Link
              href="/paper"
              className="label-mono text-text-2 underline decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
            >
              {t("ctaSecondary")}
            </Link>
          </div>

          {/* live deck — today's real intro with its real date, or the labelled
              sample (the honesty rule in this file's header comment survives). */}
          <div className="mt-8 border-l-2 border-border pl-4">
            <span className="flex items-baseline gap-2">
              <span className="article-tag">{`// ${t("heroDeckLabel")}`}</span>
              {latest ? (
                <span className="label-mono text-muted">{latest.dispatch_date}</span>
              ) : (
                <SampleBadge label={t("sampleBadge")} />
              )}
            </span>
            <p className="mt-2 font-body text-lg leading-relaxed text-text prose-measure">
              {latest ? introText : t("sampleHeadline")}
            </p>
          </div>
        </div>

        {/* ── At-a-glance box: real badge/ranking data, or the labelled sample ── */}
        <aside className="self-start rounded-md border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="article-tag">{`// ${t("glanceTitle")}`}</span>
            <span className="flex items-baseline gap-2">
              {latest ? null : <SampleBadge label={t("sampleBadge")} />}
              <span className="label-mono text-muted">{t("glanceKicker")}</span>
            </span>
          </div>
          <hr className="rule-hair mt-3 mb-1" />
          {glanceRows.map((row) => (
            <GlanceRow key={row.label} label={row.label} value={row.value} />
          ))}
          {glanceText ? (
            <p className="mt-4 font-body text-md leading-relaxed text-text">{glanceText}</p>
          ) : null}
          <p className="mt-4 font-body text-md leading-relaxed text-text-2">{t("glanceNote")}</p>
        </aside>
      </section>

      {/* ── sample article — illustrative copy, shown ONLY when no real dispatch
             exists yet (the real one is a click away otherwise) ── */}
      {latest ? null : (
        <section className="mt-16 max-w-2xl border-t border-border pt-10">
          <span className="flex items-baseline gap-3">
            <span className="article-tag">{`// ${t("articleTag")}`}</span>
            <SampleBadge label={t("sampleBadge")} />
          </span>
          <h2 className="mt-3 text-4xl font-semibold text-text">{t("sampleHeadline")}</h2>
          <p className="editorial-quote mt-5 text-xl">{t("sampleDeck")}</p>
          <p className="mt-6 font-body text-base leading-relaxed text-text">{t("sampleBody")}</p>
        </section>
      )}

      {/* ── CTA band ── */}
      <section className="mt-16 rounded-md border border-border bg-surface-2 p-8 sm:p-10">
        <span className="article-tag">{`// ${t("ctaButton")}`}</span>
        <h2 className="mt-3 text-4xl font-semibold text-text">{t("ctaTitle")}</h2>
        <p className="mt-4 max-w-xl leading-relaxed text-text-2">{t("ctaBody")}</p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <Link
            href="/dispatch"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-on-primary transition-colors hover:bg-primary-hover"
          >
            {t("ctaButton")}
          </Link>
          {/* the site's only account entry outside /login itself (audit 4B-2):
              the free account's real returns — deep-read + Telegram. */}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-full border border-border px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-text-2 transition-colors hover:border-accent hover:text-accent"
          >
            {t("ctaSignup")}
          </Link>
        </div>
      </section>
    </div>
  );
}
