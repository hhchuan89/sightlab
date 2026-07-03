/**
 * Cycle chip (PLAN §4.4): Templeton phase label + qualitative confidence ONLY.
 * It carries NO scores — no `composite_score`, no `composite_precise`, no
 * layer totals, no `dispersion_index`. Those live in the full §7 table.
 *
 * Deep-review PR-3: the internal 1–6 `stage_num` prefix is no longer rendered —
 * it is a different ladder from the Templeton label ("Stage 5 · Stage 4
 * Euphoria" read as a contradiction), and the label alone carries the phase.
 */
export function CycleBadge({
  templetonLabel,
  stageLabel,
  confidenceLabel,
  confidenceValue,
}: {
  /** already-localized Templeton phase label (the caller resolves the locale). */
  templetonLabel: string;
  /** localized "Cycle phase" caption. */
  stageLabel: string;
  /** localized "Confidence" caption. */
  confidenceLabel: string;
  /** already-localized confidence word (the caller resolves the locale). */
  confidenceValue: string;
}) {
  return (
    <div className="inline-flex flex-wrap items-stretch gap-2">
      <div className="rounded-md border border-border bg-surface px-3.5 py-2">
        <div className="label-mono text-muted">{stageLabel}</div>
        <div className="mt-0.5 font-mono text-lg font-semibold text-text">{templetonLabel}</div>
      </div>
      <div className="rounded-md border border-border bg-primary-soft px-3.5 py-2">
        <div className="label-mono text-muted">{confidenceLabel}</div>
        <div className="mt-0.5 font-mono text-lg font-semibold text-accent">{confidenceValue}</div>
      </div>
    </div>
  );
}
