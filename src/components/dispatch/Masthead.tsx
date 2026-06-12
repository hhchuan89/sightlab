/**
 * Dispatch masthead (PLAN §4.4): serif headline-ish dispatch line on the left,
 * mono date on the right, divided by the thick 2.5px ink rule. Free-safe — it
 * only ever receives a date + an optional dispatch number.
 */
export function Masthead({
  date,
  label,
  generatedLabel,
}: {
  date: string;
  /** mono tag on the left, e.g. "// DAILY DISPATCH". */
  label: string;
  /** optional right-side caption (e.g. "Generated 00:03 UTC"). */
  generatedLabel?: string;
}) {
  return (
    <header>
      <div className="flex items-baseline justify-between gap-4">
        <span className="article-tag">{`// ${label}`}</span>
        <span className="label-mono text-muted">
          {date}
          {generatedLabel ? ` · ${generatedLabel}` : ""}
        </span>
      </div>
      <hr className="rule-ink mt-3" />
    </header>
  );
}
