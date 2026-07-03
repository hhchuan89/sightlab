import { pick } from "@/lib/i18n/pick";
import { etfDisplayName } from "@/lib/dispatch/etfNames";
import { adSignalWord } from "@/lib/dispatch/displayWords";
import type { Locale } from "@/lib/i18n/request";
import type { FlowsSection6 } from "@/lib/dispatch/types";

/**
 * §6 Weekly Fund Flows table (PLAN §4.4) — mono, amber uppercase headers, dashed
 * row borders, `--success`/`--danger` for flow direction. Content is PUBLIC in
 * v3 (PLAN §15.1); the dispatch pages always render this with the full
 * `flows_section6` block. It receives the projected §6 block, never the whole
 * dispatch object.
 *
 * 2026-06-17: added the "Vol Δ%" column (carried over from the daily-news §7.3 table
 * during the de-dup) + a crypto-proxy footnote (IBIT/FBTC are a volume proxy, not real
 * fund-flow data) + a weak-signal marker so an A/D flip just past the ±0.3 cut reads
 * as weak, not strong.
 */

function pct(n: number): string {
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function pct1(n: number): string {
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

function signalClass(signal: string): string {
  if (signal === "ACCUMULATION") return "text-success";
  if (signal === "DISTRIBUTION") return "text-danger";
  return "text-muted";
}

export function Section6Table({
  data,
  locale,
  headers,
  tag,
  coreReadingLabel,
  glossaryLink,
}: {
  data: FlowsSection6;
  locale: Locale;
  headers: {
    etf: string;
    sector: string;
    thisWeek: string;
    prevWeek: string;
    volChange: string;
    signal: string;
    note: string;
    proxyFootnote: string;
    weakMarker: string;
    weakFootnote: string;
  };
  /** mono article tag, e.g. "WEEKLY FUND FLOWS · §6". */
  tag: string;
  coreReadingLabel: string;
  /** localized anchor text linking to the foot-of-page glossary. */
  glossaryLink: string;
}) {
  const hasProxy = data.rows.some((r) => r.proxy_only);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <span className="article-tag">{`// ${tag}`}</span>
        <a href="#glossary-heading" className="label-mono text-muted hover:text-accent">
          {glossaryLink}
        </a>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-sm">
          <thead>
            <tr className="article-tag">
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                {headers.etf}
              </th>
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                {headers.sector}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {headers.thisWeek}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {headers.prevWeek}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                {headers.volChange}
              </th>
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                {headers.signal}
              </th>
              <th scope="col" className="w-2/5 py-2 text-left font-semibold">
                {headers.note}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.etf} className="border-b border-dashed border-border align-top">
                <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-text">
                  {row.etf}
                  {row.proxy_only ? <span className="text-muted">†</span> : null}
                </th>
                <td className="py-2.5 pr-4 text-text-2">
                  {etfDisplayName(row.etf, row.name_zh, locale)}
                </td>
                <td
                  className={`py-2.5 pr-4 text-right tabular-nums ${
                    row.this_week_return_pct >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {pct(row.this_week_return_pct)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                  {pct(row.prev_week_return_pct)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                  {pct1(row.vol_change_pct)}
                </td>
                <td className={`py-2.5 pr-4 font-semibold ${signalClass(row.ad_signal)}`}>
                  {adSignalWord(row.ad_signal, locale)}
                  {row.ad_confidence === "weak" && row.ad_signal !== "NEUTRAL" ? (
                    <span className="ml-1 font-mono text-xs font-normal text-muted">
                      ({headers.weakMarker})
                    </span>
                  ) : null}
                </td>
                <td className="w-2/5 py-2.5 font-body text-md leading-relaxed text-text">
                  {pick(row.signal, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* permanent weak-signal footnote (deep-review 4A#4): the "only strong
          signals carry conclusions" reading rule must live next to the table,
          not behind the login-gated deep-read. */}
      <p className="mt-3 font-mono text-xs text-muted">{headers.weakFootnote}</p>
      {hasProxy ? (
        <p className="mt-1 font-mono text-xs text-muted">† {headers.proxyFootnote}</p>
      ) : null}

      <div className="mt-5">
        <span className="label-mono text-muted">{coreReadingLabel}</span>
        <p className="mt-2 font-body text-base leading-relaxed text-text prose-measure">
          {pick(data.core_reading, locale)}
        </p>
      </div>
    </section>
  );
}
