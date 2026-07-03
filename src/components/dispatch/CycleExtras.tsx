import { getTranslations } from "next-intl/server";
import { pick } from "@/lib/i18n/pick";
import { cyclePhaseLabel } from "@/lib/dispatch/displayWords";
import type { Locale } from "@/lib/i18n/request";
import type { CycleExtras as CycleExtrasData } from "@/lib/dispatch/types";

/**
 * §7 supplementary "alongside" reads (report 20260614 P0/P1/P2) — reported NEXT TO
 * the cycle composite, NEVER merged into it. Market-only, no holdings (PLAN §15.4).
 * Honest framing per the sightlab-writing voice: the composite above is the confirmer
 * ANCHOR; these add a calibrated number, a leading lean (explicitly low-confidence,
 * not a forecast), a decorrelated cross-check, and how long we've held the stage.
 *
 * Every sub-block is optional — renders only what the snapshot carried, so it stays
 * empty (and the whole section hides) until the weekly composite produces the fields.
 */

function signed1(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}

export async function CycleExtras({ data, locale }: { data: CycleExtrasData; locale: Locale }) {
  const t = await getTranslations("dispatch");
  const probit = data.recession_probit_p;
  const yc = data.yield_curve;
  const sleeve = data.leading_sleeve;
  const bv = data.composite_blockvote;
  const rg = data.regime_persistence;

  if (!probit && !yc && !sleeve && !bv && !rg) return null;

  const tiltClass =
    sleeve?.tilt === "deteriorating"
      ? "text-danger"
      : sleeve?.tilt === "improving"
        ? "text-success"
        : "text-text-2";

  return (
    <section>
      <span className="article-tag">{`// ${t("cx.tag")}`}</span>

      <dl className="mt-4 space-y-4">
        {probit ? (
          <div>
            <dt className="label-mono text-muted">{t("cx.probit")}</dt>
            <dd className="mt-1 font-body text-text">
              <span className="font-mono font-semibold tabular-nums">
                {probit.value_pct.toFixed(1)}%
              </span>{" "}
              <span className="text-text-2">— {t("cx.probitSource")}</span>
              {probit.as_of ? (
                <span className="text-muted">
                  {" "}
                  ({t("cx.asOf")} {probit.as_of})
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}

        {yc ? (
          <div>
            <dt className="label-mono text-muted">{t("cx.yieldCurve")}</dt>
            <dd className="mt-1 font-body text-text">
              <span className="font-mono font-semibold tabular-nums">{yc.spread_bps} bps</span>{" "}
              <span className="text-text-2">· {t(`cx.level.${yc.level}`)}</span>
              {yc.trajectory ? (
                <span className="text-muted"> · {t(`cx.traj.${yc.trajectory}`)}</span>
              ) : null}
            </dd>
          </div>
        ) : null}

        {sleeve ? (
          <div>
            <dt className="label-mono text-muted">{t("cx.leadingSleeve")}</dt>
            <dd className="mt-1 font-body text-text">
              <span className={`font-semibold ${tiltClass}`}>{t(`cx.tilt.${sleeve.tilt}`)}</span>
              <p className="mt-1 font-body text-md leading-relaxed text-muted prose-measure">
                {t("cx.sleeveFrame")}
              </p>
            </dd>
          </div>
        ) : null}

        {bv ? (
          <div>
            <dt className="label-mono text-muted">{t("cx.blockvote")}</dt>
            <dd className="mt-1 font-body text-text">
              <span className="font-mono tabular-nums text-text-2">{signed1(bv.rescaled)}</span>{" "}
              <span className="text-text-2">
                {/* implied_stage is a Templeton label → same Phase remap as the badge */}→{" "}
                {cyclePhaseLabel(pick(bv.implied_stage, locale), locale)}
              </span>
              <p className="mt-1 font-body text-md leading-relaxed text-muted prose-measure">
                {t("cx.blockvoteFrame")}
              </p>
            </dd>
          </div>
        ) : null}

        {rg ? (
          <div>
            <dt className="label-mono text-muted">{t("cx.regime")}</dt>
            <dd className="mt-1 font-body text-text">
              <span className="text-text-2">
                {t("cx.dwell", { n: rg.dwell_snapshots })} · {pick(rg.direction, locale)}
              </span>
              <span className="text-muted">
                {" "}
                · {rg.transition_suppressed ? t("cx.unconfirmed") : t("cx.confirmed")}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
