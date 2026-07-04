import { pick } from "@/lib/i18n/pick";
import type { Locale } from "@/lib/i18n/request";
import type { CycleSection7 } from "@/lib/dispatch/types";

/**
 * §7 Market Cycle Positioning table (PLAN §4.4) — mono table with inline
 * Weinstein-stage badges + a CSS bar for dispersion. Content is PUBLIC in v3
 * (PLAN §15.1); the dispatch pages always render this with the full
 * `cycle_section7` block, including the §7 numeric scores (composite,
 * dispersion index). Receives the projected §7 block, never the whole
 * dispatch object.
 */

function StageBadge({ stage }: { stage: number }) {
  // Weinstein stages: 2 = advancing (good), 4 = declining (bad), 1/3 = base/top.
  const tone =
    stage === 2
      ? "bg-primary-soft text-success"
      : stage === 4
        ? "bg-primary-soft text-danger"
        : "bg-surface-2 text-text-2";
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${tone}`}>
      {`S${stage}`}
    </span>
  );
}

function pct(n: number): string {
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

export function Section7Table({
  data,
  locale,
  headers,
  tag,
  dispersionLabel,
  todayCoreLabel,
  narrativeLabel,
  glossaryLink,
}: {
  data: CycleSection7;
  locale: Locale;
  headers: {
    symbol: string;
    stage: string;
    /** in-place one-line glosses (audit 20260704 PR-C): the three most opaque
        columns explain themselves in the header instead of only in the
        foot-of-page glossary. */
    stageGloss: string;
    distance: string;
    distanceGloss: string;
    slope: string;
    slopeGloss: string;
    judgment: string;
  };
  tag: string;
  dispersionLabel: string;
  todayCoreLabel: string;
  narrativeLabel: string;
  /** localized anchor text linking to the foot-of-page glossary. */
  glossaryLink: string;
}) {
  const { dispersion } = data;
  // Normalize the dispersion index to a 0..100 bar (index is roughly 0..10).
  const barPct = Math.max(4, Math.min(100, dispersion.dispersion_index * 10));

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <span className="article-tag">{`// ${tag}`}</span>
        <a href="#glossary-heading" className="label-mono text-muted hover:text-accent">
          {glossaryLink}
        </a>
      </div>

      {/* dispersion summary box (the composite numeric score is internal-only and
          deliberately not surfaced; the stage + confidence live in the CycleBadge) */}
      <div className="mt-4 rounded-md border border-border bg-surface p-4">
        <span className="label-mono text-muted">{dispersionLabel}</span>
        <div className="mt-1 flex items-baseline gap-2">
          {/* Label + bar only, no naked index (deep-review 4A#8): the index is
              an UNBOUNDED stdev of sector distances (only *roughly* 0..10), so
              a bare "7.1" fights the "Medium" label on a ten-point intuition
              and any "/ 10" denominator would be false in a violent week. */}
          <span className="font-mono text-lg font-semibold text-text">
            {pick(dispersion.dispersion_label, locale)}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary" style={{ width: `${barPct}%` }} />
        </div>
      </div>

      {/* per-sector table */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-sm">
          <thead>
            <tr className="article-tag">
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                {headers.symbol}
              </th>
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                {headers.stage}
                <span className="mt-0.5 block font-normal normal-case tracking-normal text-2xs text-muted">
                  {headers.stageGloss}
                </span>
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {headers.distance}
                <span className="mt-0.5 block font-normal normal-case tracking-normal text-2xs text-muted">
                  {headers.distanceGloss}
                </span>
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {headers.slope}
                <span className="mt-0.5 block font-normal normal-case tracking-normal text-2xs text-muted">
                  {headers.slopeGloss}
                </span>
              </th>
              <th scope="col" className="py-2 text-left font-semibold">
                {headers.judgment}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.sectors.map((s) => (
              <tr key={s.symbol} className="border-b border-dashed border-border align-top">
                <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-text">
                  {s.symbol}
                </th>
                <td className="py-2.5 pr-4">
                  <StageBadge stage={s.weinstein_stage} />
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-text-2">
                  {pct(s.distance_pct)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-text-2">
                  {pct(s.slope_pct)}
                </td>
                <td className="py-2.5 font-body text-md leading-relaxed text-text">
                  {pick(s.judgment, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* prose: today's core read, then weekly narrative if present */}
      <div className="mt-5">
        <span className="label-mono text-muted">{todayCoreLabel}</span>
        <p className="mt-2 font-body text-base leading-relaxed text-text prose-measure">
          {pick(data.today_core, locale)}
        </p>
      </div>

      {data.full_narrative ? (
        <div className="mt-5">
          <span className="label-mono text-muted">{narrativeLabel}</span>
          <p className="mt-2 font-body text-base leading-relaxed text-text prose-measure">
            {pick(data.full_narrative, locale)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
