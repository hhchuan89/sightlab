import type { CycleBadge as CycleBadgeData } from "@/lib/dispatch/types";

/**
 * Cycle chip (PLAN §4.4): stage number + Templeton stage label + qualitative
 * confidence ONLY. It carries NO scores — no `composite_score`, no
 * `composite_precise`, no layer totals, no `dispersion_index`. Those live in
 * the full §7 table; the type `CycleBadge` cannot hold them.
 */
export function CycleBadge({
  badge,
  stageLabel,
  confidenceLabel,
}: {
  badge: CycleBadgeData;
  /** localized "Cycle stage" caption. */
  stageLabel: string;
  /** localized "Confidence" caption. */
  confidenceLabel: string;
}) {
  return (
    <div className="inline-flex flex-wrap items-stretch gap-2">
      <div className="rounded-md border border-border bg-surface px-3.5 py-2">
        <div className="label-mono text-muted">{stageLabel}</div>
        <div className="mt-0.5 font-mono text-sm font-semibold text-text">
          {`Stage ${badge.stage_num} · ${badge.templeton_stage}`}
        </div>
      </div>
      <div className="rounded-md border border-border bg-primary-soft px-3.5 py-2">
        <div className="label-mono text-muted">{confidenceLabel}</div>
        <div className="mt-0.5 font-mono text-sm font-semibold text-accent">{badge.confidence}</div>
      </div>
    </div>
  );
}
