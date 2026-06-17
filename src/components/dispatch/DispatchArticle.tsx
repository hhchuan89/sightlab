import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/i18n/request";
import { pick } from "@/lib/i18n/pick";
import type { Dispatch } from "@/lib/dispatch/types";
import { Masthead } from "@/components/dispatch/Masthead";
import { AtAGlance } from "@/components/dispatch/AtAGlance";
import { CycleBadge } from "@/components/dispatch/CycleBadge";
import { CaveatNote } from "@/components/dispatch/CaveatNote";
import { Section6Table } from "@/components/dispatch/Section6Table";
import { Section7Table } from "@/components/dispatch/Section7Table";
import { CycleExtras } from "@/components/dispatch/CycleExtras";

/**
 * Full dispatch article (PLAN §15.1 — content is PUBLIC). Shared by
 * /dispatch (latest edition) and /dispatch/[date] (any archived edition):
 * masthead, intro, cycle badge, at-a-glance, then the complete §6/§7 tables.
 */
export async function DispatchArticle({ dispatch }: { dispatch: Dispatch }) {
  const locale = await resolveLocale();
  const t = await getTranslations("dispatch");

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

      {introText ? (
        <p className="font-body text-lg leading-relaxed text-text prose-measure">{introText}</p>
      ) : null}

      {dispatch.cycle_badge ? (
        <CycleBadge
          badge={dispatch.cycle_badge}
          templetonLabel={
            typeof dispatch.cycle_badge.templeton_stage === "string"
              ? dispatch.cycle_badge.templeton_stage
              : pick(dispatch.cycle_badge.templeton_stage, locale)
          }
          stageLabel={t("badgeStage")}
          confidenceLabel={t("badgeConfidence")}
        />
      ) : null}

      <AtAGlance title={t("glanceTitle")} text={glanceText} />

      {/* Full §6/§7 — PUBLIC for everyone (PLAN §15.1). */}
      <div className="space-y-12 border-t border-border pt-8">
        <Section6Table
          data={dispatch.flows_section6}
          locale={locale}
          tag={t("flowsTag")}
          coreReadingLabel={t("coreReading")}
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
          }}
        />
        <Section7Table
          data={dispatch.cycle_section7}
          locale={locale}
          tag={t("cycleTag")}
          dispersionLabel={t("dispersion")}
          todayCoreLabel={t("todayCore")}
          narrativeLabel={t("narrative")}
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

      <CaveatNote locale={locale} label={t("caveatLabel")} />
    </article>
  );
}
