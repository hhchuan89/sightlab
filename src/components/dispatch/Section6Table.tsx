import { pick } from "@/lib/i18n/pick";
import { etfDisplayName } from "@/lib/dispatch/etfNames";
import type { Locale } from "@/lib/i18n/request";
import type { FlowsSection6 } from "@/lib/dispatch/types";

/**
 * §6 Weekly Fund Flows table (PLAN §4.4) — mono, amber uppercase headers, dashed
 * row borders, `--success`/`--danger` for flow direction. Content is PUBLIC in
 * v3 (PLAN §15.1); the dispatch pages always render this with the full
 * `flows_section6` block. It receives the projected §6 block, never the whole
 * dispatch object.
 */

function pct(n: number): string {
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
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
}: {
  data: FlowsSection6;
  locale: Locale;
  headers: {
    etf: string;
    sector: string;
    thisWeek: string;
    prevWeek: string;
    signal: string;
    note: string;
  };
  /** mono article tag, e.g. "WEEKLY FUND FLOWS · §6". */
  tag: string;
  coreReadingLabel: string;
}) {
  return (
    <section>
      <span className="article-tag">{`// ${tag}`}</span>

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
              <th scope="col" className="py-2 pr-4 text-left font-semibold">
                {headers.signal}
              </th>
              <th scope="col" className="py-2 text-left font-semibold">
                {headers.note}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.etf} className="border-b border-dashed border-border align-top">
                <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-text">
                  {row.etf}
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
                <td className={`py-2.5 pr-4 font-semibold ${signalClass(row.ad_signal)}`}>
                  {row.ad_signal}
                </td>
                <td className="py-2.5 font-serif text-sm leading-relaxed text-text-2">
                  {pick(row.signal, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <span className="label-mono text-muted">{coreReadingLabel}</span>
        <p className="mt-2 font-serif leading-relaxed text-text-2">
          {pick(data.core_reading, locale)}
        </p>
      </div>
    </section>
  );
}
