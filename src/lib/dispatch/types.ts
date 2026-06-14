/**
 * Dispatch CONTENT contract — TypeScript mirror of PLAN §5.2 + the §15.1 PUBLIC
 * RPC projection shape.
 *
 * v3 OPEN/FREE pivot (PLAN §15.1): content is PUBLIC. The public read RPCs return
 * the FULL projection to everyone, so `flows_section6` / `cycle_section7` are
 * always present — they are NON-OPTIONAL on the projected `Dispatch` type.
 *
 * Numbers are computed once in Python and are language-neutral (PLAN §5.1); only
 * prose is bilingual. `Bilingual<T>` defaults to a string pair, matching the
 * `{ en, zh }` prose fields in the contract.
 */

/** A bilingual prose field. Defaults to a string pair (`{ en, zh }`). */
export type Bilingual<T = string> = { en: T; zh: T };

/** Confidence is a rule-based qualitative label (no numeric score leaks free). */
export type Confidence = "High" | "Medium" | "Low";

// ─────────────────────────── badge / meta ───────────────────────────

/**
 * Cycle badge: stage + qualitative confidence. (Detailed scores live in the
 * public `cycle_section7` block — content is no longer gated in v3.)
 */
export interface CycleBadge {
  stage_num: number;
  /**
   * Bilingual Templeton-stage label (§14-C1). Was a bare ZH string, which leaked
   * Chinese into the EN UI; now `{ en, zh }` so each locale renders its own.
   */
  templeton_stage: Bilingual;
  confidence: Confidence;
}

// ─────────────────────────── §6: weekly fund flows (public) ───────────────────────────

export type AdSignal = "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";

/** One ETF row of the §6 weekly fund-flow table (numbers are neutral). */
export interface FlowRow {
  etf: string;
  name_zh: string;
  this_week_return_pct: number;
  prev_week_return_pct: number;
  avg_daily_volume: number;
  vol_change_pct: number;
  week_turnover_usd: number;
  ad_signal: AdSignal;
  ad_score: number;
  /** table2 per-ETF narrative prose. */
  signal: Bilingual;
}

/** §6 block (public in v3): the weekly fund-flows table + core reading prose. */
export interface FlowsSection6 {
  table1_markdown: string;
  rows: FlowRow[];
  core_reading: Bilingual;
}

// ─────────────────────────── §7: cycle positioning (public) ───────────────────────────

/** One sector row of the §7 cycle table (numbers are neutral). */
export interface SectorRow {
  symbol: string;
  distance_pct: number;
  slope_pct: number;
  weinstein_stage: number;
  trend_score: number;
  vol_ratio_5d_20d: number;
  volume_flag: string;
  in_std: boolean;
  /**
   * Market-structure judgment prose ONLY (PLAN §15.4 PRIVACY, LOCKED): 资金×趋势
   * commentary such as "tech stage-2 confirmed uptrend; energy distributing".
   * NEVER "what to do with your position" — no holdings / portfolio action.
   */
  judgment: Bilingual;
}

export interface Dispersion {
  dispersion_index: number;
  /**
   * §14-C2: the ZH enum (高/中/低) from `query_sector_dispersion.py` is
   * translated to a bilingual pair by `assemble_dispatch.py`.
   */
  dispersion_label: Bilingual;
  /**
   * §5.2 typed this as an int, but `query_sector_dispersion.py` emits a STRING
   * span ("S2–S4"); accept either (the ingest zod schema validates the union).
   */
  stage_spread: number | string;
  sector_ranking: string[];
}

export interface Composite {
  composite_score: number;
  composite_precise: number;
  templeton_stage: string;
  cycle_stage_num: number;
  confidence: Confidence;
  confidence_breakdown: Record<string, unknown>;
  contrarian_overlay: Record<string, unknown>;
  valuation_a_score: number;
  layer_totals: Record<string, unknown>;
}

/** §7 block (public in v3): sectors, dispersion, composite + prose. */
export interface CycleSection7 {
  sectors: SectorRow[];
  dispersion: Dispersion;
  composite: Composite;
  today_core: Bilingual;
  /** weekly/triggered only — may be null on weekdays (PLAN §5.2, §14-C1). */
  full_narrative: Bilingual | null;
}

// ─────────────────────────── Projected RPC result ───────────────────────────

/**
 * Shape returned by the PUBLIC read RPCs (`get_latest_public` /
 * `get_dispatch_public`) AFTER the §15.1 full projection.
 *
 * Content is PUBLIC, so `flows_section6` / `cycle_section7` are always present
 * (non-optional). `is_locked` is always `false` for content in v3 — kept on the
 * shape for backward compatibility with the parked paid-tier code path.
 */
export interface Dispatch {
  dispatch_date: string;
  generated_at: string;
  /** "daily" (Tue–Sat US-close) or "weekly" (Sun review). Defaults to "daily". */
  kind: "daily" | "weekly";
  intro_en: string | null;
  intro_zh: string | null;
  at_a_glance_en: string | null;
  at_a_glance_zh: string | null;
  cycle_badge: CycleBadge | null;
  is_locked: boolean;
  flows_section6: FlowsSection6;
  cycle_section7: CycleSection7;
}

/** One history-list row from `list_dispatches_public` (metadata only). */
export interface HistoryRow {
  dispatch_date: string;
  intro_en: string | null;
  intro_zh: string | null;
}
