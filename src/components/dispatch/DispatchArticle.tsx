import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/request";
import { pick } from "@/lib/i18n/pick";
import { cyclePhaseLabel, confidenceWord } from "@/lib/dispatch/displayWords";
import { getSession } from "@/lib/auth/getSession";
import type { Dispatch } from "@/lib/dispatch/types";
import { Masthead } from "@/components/dispatch/Masthead";
import { AtAGlance } from "@/components/dispatch/AtAGlance";
import { CycleBadge } from "@/components/dispatch/CycleBadge";
import { CaveatNote } from "@/components/dispatch/CaveatNote";
import { Section6Table } from "@/components/dispatch/Section6Table";
import { Section7Table } from "@/components/dispatch/Section7Table";
import { CycleExtras } from "@/components/dispatch/CycleExtras";
import { DeepReadSection } from "@/components/dispatch/DeepReadSection";
import { CycleGlossary } from "@/components/dispatch/CycleGlossary";

/**
 * Full dispatch article (PLAN §15.1 — content is PUBLIC). Shared by
 * /dispatch (latest edition) and /dispatch/[date] (any archived edition):
 * masthead, intro, cycle badge, at-a-glance, then the complete §6/§7 tables.
 */
export async function DispatchArticle({ dispatch }: { dispatch: Dispatch }) {
  const locale = await resolveLocale();
  const t = await getTranslations("dispatch");
  // §15.9: the deep-read BODY is login-gated. We read the session server-side and
  // pass `body` in ONLY when authenticated — for anon it is never serialized.
  const { user } = await getSession();
  const deepread = dispatch.deepread_section;

  const introText = pick({ en: dispatch.intro_en ?? "", zh: dispatch.intro_zh ?? "" }, locale);
  const glanceText = pick(
    { en: dispatch.at_a_glance_en ?? "", zh: dispatch.at_a_glance_zh ?? "" },
    locale,
  );

  return (
    <article className="space-y-8">
      <Masthead
        date={dispatch.dispatch_date}
        label={dispatch.kind === "weekly" ? t("tagWeekly") : t("tag")}
      />

      {/* Page theme sentence (audit 20260704 P0-2): the page's first element used
          to be a bare date — no <h1>, no information scent. The title states the
          one thing the edition is about: where the cycle stands today. */}
      {dispatch.cycle_badge ? (
        <h1 className="font-serif text-4xl font-semibold text-text">
          {t("pageTitle", {
            phase: cyclePhaseLabel(
              typeof dispatch.cycle_badge.templeton_stage === "string"
                ? dispatch.cycle_badge.templeton_stage
                : pick(dispatch.cycle_badge.templeton_stage, locale),
              locale,
            ),
          })}
        </h1>
      ) : null}

      {introText ? (
        <p className="font-body text-lg leading-relaxed text-text prose-measure">{introText}</p>
      ) : null}

      {dispatch.cycle_badge ? (
        <CycleBadge
          templetonLabel={cyclePhaseLabel(
            typeof dispatch.cycle_badge.templeton_stage === "string"
              ? dispatch.cycle_badge.templeton_stage
              : pick(dispatch.cycle_badge.templeton_stage, locale),
            locale,
          )}
          stageLabel={t("badgeStage")}
          confidenceLabel={t("badgeConfidence")}
          confidenceValue={confidenceWord(dispatch.cycle_badge.confidence, locale)}
        />
      ) : null}

      <AtAGlance title={t("glanceTitle")} kicker={t("glanceKicker")} text={glanceText} />

      {/* Full §6/§7 — PUBLIC for everyone (PLAN §15.1). */}
      <div className="space-y-12 border-t border-border pt-8">
        <Section6Table
          data={dispatch.flows_section6}
          locale={locale}
          tag={t("flowsTag")}
          coreReadingLabel={t("coreReading")}
          glossaryLink={t("glossaryLink")}
          headers={{
            etf: t("s6.etf"),
            sector: t("s6.sector"),
            thisWeek: t("s6.thisWeek"),
            prevWeek: t("s6.prevWeek"),
            volChange: t("s6.volChange"),
            signal: t("s6.signal"),
            note: t("s6.note"),
            proxyFootnote: t("s6.proxyFootnote"),
            weakMarker: t("s6.weakMarker"),
            weakFootnote: t("s6.weakFootnote"),
          }}
        />
        <Section7Table
          data={dispatch.cycle_section7}
          locale={locale}
          tag={t("cycleTag")}
          dispersionLabel={t("dispersion")}
          todayCoreLabel={t("todayCore")}
          narrativeLabel={t("narrative")}
          glossaryLink={t("glossaryLink")}
          headers={{
            symbol: t("s7.symbol"),
            stage: t("s7.stage"),
            distance: t("s7.distance"),
            slope: t("s7.slope"),
            judgment: t("s7.judgment"),
          }}
        />
        {dispatch.cycle_section7.cycle_extras ? (
          <CycleExtras data={dispatch.cycle_section7.cycle_extras} locale={locale} />
        ) : null}
      </div>

      {/* §15.9 market-structure deep-read — public teaser; full body login-gated. */}
      {deepread ? (
        <DeepReadSection
          teaser={pick(deepread.teaser, locale)}
          body={user ? pick(deepread.body, locale) : null}
          labels={{
            tag: t("deepread.tag"),
            title: t("deepread.title"),
            lockedTitle: t("deepread.lockedTitle"),
            lockedBody: t("deepread.lockedBody"),
            cta: t("deepread.cta"),
            // carry the CURRENT edition's date so a reader unlocking an archived
            // deep-read lands back on that edition, not the latest (deep-review 2C-⑫)
            ctaHref: `/login?next=/dispatch/${dispatch.dispatch_date}`,
            reassure: t("deepread.reassure"),
          }}
        />
      ) : null}

      {/* Closing colophon: the model-limitation caveat is the article's last word,
          immediately above the footer (PLAN §11 — "confirmer, not predictor"). */}
      <CaveatNote locale={locale} label={t("caveatLabel")} />

      {/* Permanent terms glossary — the page's closing reference appendix (PLAN
          §15.1 market-only). Static; identical every edition. */}
      <CycleGlossary />
    </article>
  );
}
