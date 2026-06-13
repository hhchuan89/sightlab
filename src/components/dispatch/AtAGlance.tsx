/**
 * At-a-glance box (PLAN §4.4) — SELF-CONTAINED summary. It renders the short
 * prose paragraph the harness wrote to TELL the story qualitatively (stage,
 * ACCUMULATION/DISTRIBUTION, leader/laggard direction) as a quick read above
 * the full §6/§7 tables, which carry the numbers.
 *
 * It takes only the rendered summary string — never the full dispatch object —
 * so it stays decoupled from the dispatch shape.
 */
export function AtAGlance({
  title,
  text,
  rows,
}: {
  title: string;
  /** the at-a-glance prose for the active locale. */
  text: string;
  /** optional dotted-leader rows (label/value pairs), all free-safe scalars. */
  rows?: { key: string; value: string }[];
}) {
  return (
    <aside className="rounded-md border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="article-tag">{`// ${title}`}</span>
        <span className="label-mono text-muted">§6 · §7</span>
      </div>
      <hr className="rule-hair mt-3 mb-1" />

      {rows && rows.length > 0 ? (
        <div className="mb-3">
          {rows.map((r) => (
            <div className="leader-row" key={r.key}>
              <span className="leader-key">{r.key}</span>
              <span className="leader-dots" aria-hidden />
              <span className="leader-value">{r.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {text ? (
        <p className="mt-3 font-body text-base leading-relaxed text-text prose-measure">{text}</p>
      ) : null}
    </aside>
  );
}
