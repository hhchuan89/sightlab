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
  compositeLabel,
  todayCoreLabel,
  narrativeLabel,
}: {
  data: CycleSection7;
  locale: Locale;
  headers: {
    symbol: string;
    stage: string;
    distance: string;
    slope: string;
    judgment: string;
  };
  tag: string;
  dispersionLabel: string;
  compositeLabel: string;
  todayCoreLabel: string;
  narrativeLabel: string;
}) {
  const { composite, dispersion } = data;
  // Normalize the dispersion index to a 0..100 bar (index is roughly 0..10).
  const barPct = Math.max(4, Math.min(100, dispersion.dispersion_index * 10));

  return (
    <section>
      <span className="article-tag">{`// ${tag}`}</span>

      {/* composite + dispersion summary strip (§7 numeric scores) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-4">
          <span className="label-mono text-muted">{compositeLabel}</span>
          <div className="mt-1 font-mono text-lg font-semibold text-text tabular-nums">
            {composite.composite_precise.toFixed(2)}
            <span className="ml-2 text-sm font-medium text-muted">
              {`Stage ${composite.cycle_stage_num} · ${composite.templeton_stage} · ${composite.confidence}`}
            </span>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <span className="label-mono text-muted">{dispersionLabel}</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold text-text tabular-nums">
              {dispersion.dispersion_index.toFixed(1)}
            </span>
            <span className="text-sm text-muted">{pick(dispersion.dispersion_label, locale)}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary" style={{ width: `${barPct}%` }} />
          </div>
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
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {headers.distance}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {headers.slope}
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
                <td className="py-2.5 font-serif text-sm leading-relaxed text-text-2">
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
        <p className="mt-2 font-serif leading-relaxed text-text-2">
          {pick(data.today_core, locale)}
        </p>
      </div>

      {data.full_narrative ? (
        <div className="mt-5">
          <span className="label-mono text-muted">{narrativeLabel}</span>
          <p className="mt-2 font-serif leading-relaxed text-text-2">
            {pick(data.full_narrative, locale)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
