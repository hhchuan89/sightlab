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
  tensionText,
}: {
  /** already-localized Templeton phase label (the caller resolves the locale). */
  templetonLabel: string;
  /** localized "Cycle phase" caption. */
  stageLabel: string;
  /** localized "Confidence" caption. */
  confidenceLabel: string;
  /** already-localized confidence word (the caller resolves the locale). */
  confidenceValue: string;
  /**
   * Already-localized flows-vs-structure tension warning (task 2, 2026-07-19
   * phase2, rendering `cycle_badge.tension` — schema added task D, 2026-07-18
   * audit fix F4). Present only when ≥2 core sectors fire strong DISTRIBUTION
   * while their §7 Weinstein stage still reads 2 ("money leaving while
   * structure holds"). Undefined/absent on ordinary dispatches — renders
   * nothing, no placeholder, when omitted.
   */
  tensionText?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex flex-wrap items-stretch gap-2">
        <div className="rounded-md border border-border bg-surface px-3.5 py-2">
          <div className="label-mono text-muted">{stageLabel}</div>
          {/* serif, not mono: the phase label is CONTENT (Chinese words), and the
              mono chain has no CJK — Han here used to fall through to the system
              sans, the page's most visible mixed-font spot (audit 20260704). */}
          <div className="mt-0.5 font-serif text-lg font-semibold text-text">{templetonLabel}</div>
        </div>
        <div className="rounded-md border border-border bg-primary-soft px-3.5 py-2">
          <div className="label-mono text-muted">{confidenceLabel}</div>
          <div className="mt-0.5 font-serif text-lg font-semibold text-accent">
            {confidenceValue}
          </div>
        </div>
      </div>
      {tensionText ? (
        // Warm-paper warning chip (brand §3): amber-soft fill (bg-primary-soft,
        // the same token the confidence box above uses) + the existing danger
        // text color — no new color invented. `role="status"` because this is
        // an informational state flag, not a page alert.
        <div
          role="status"
          className="inline-flex max-w-prose items-start gap-2 rounded-md border border-border bg-primary-soft px-3.5 py-2"
        >
          <span aria-hidden="true" className="text-danger">
            ⚠
          </span>
          <p className="font-body text-sm leading-snug text-danger">{tensionText}</p>
        </div>
      ) : null}
    </div>
  );
}
