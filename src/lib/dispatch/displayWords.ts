import type { Locale } from "@/lib/i18n/request";

/**
 * Display-level localization for the FIXED payload enums (deep-review PR-3).
 *
 * Two jobs:
 *
 * 1. `cyclePhaseLabel` renames the page-top Templeton ladder from "Stage" to
 *    "Phase" (EN) / 「第 N 期」 (ZH). The dispatch renders TWO four-step ladders
 *    that both said "Stage"/「阶段」: Templeton sentiment (page top) and
 *    Weinstein trend (§7 sector table) — same numbers, opposite meanings
 *    (Templeton stage 3 = optimism; Weinstein Stage 3 = topping), and the
 *    glossary only explains Weinstein. Display-level remap so archived
 *    dispatches (which carry the old label strings) are fixed too. Unknown
 *    labels pass through unchanged — producer drift degrades, never crashes.
 *
 * 2. `confidenceWord` / `adSignalWord` localize the 3-value enums so the ZH
 *    page never shows raw English enums ("High", "ACCUMULATION").
 */
const PHASE_EN: Record<string, string> = {
  "Stage 4 Euphoria (top/bubble · caution)": "Phase 4 euphoria (top/bubble · caution)",
  // 2026-07-18 phase1 task A: the producer already emits the bilingual
  // "Stage 4 euphoria fading (caution)" / "第 4 期 亢奋·回落（警惕）" pair
  // (assemble_dispatch.py TEMPLETON_PHASE_EN/ZH), but archived dispatches from
  // before that change carry the raw ZH harness label here too — remap it.
  "Stage 4 euphoria fading (caution)": "Phase 4 euphoria fading (caution)",
  "Stage 4 early (healthy optimism)": "Phase 4 early (healthy optimism)",
  "Stage 3 (optimism)": "Phase 3 (optimism)",
  "Stage 2/3 transition": "Phase 2/3 transition",
  "Stage 1/4 transition": "Phase 1/4 transition",
  "Stage 4-late / 1-early": "Phase 4-late / 1-early",
};

const PHASE_ZH: Record<string, string> = {
  // Phase 1b (2026-07-18 plain-ZH pass): "亢奋" (a word most readers would have
  // to look up) → "过热"(顶部风险) — same state, plainer word. Keys stay the
  // harness's raw "阶段 4 亢奋…" strings (data contract untouched); only the
  // rendered value changed, mirroring assemble_dispatch.py TEMPLETON_PHASE_ZH.
  "阶段 4 亢奋（顶/泡沫·警惕）": "第 4 期 过热（顶部风险·警惕）",
  "阶段 4 亢奋·回落（警惕）": "第 4 期 过热·回落（警惕）",
  "阶段 4 早期（健康乐观）": "第 4 期早期（健康乐观）",
  "阶段 3（乐观）": "第 3 期（乐观）",
  "阶段 2/3 过渡": "第 2/3 期过渡",
  "阶段 1/4 过渡": "第 1/4 期过渡",
  "阶段 4末/1早": "第 4 期末/第 1 期初",
};

/** Templeton label → "Phase" wording for the page-top cycle badge. */
export function cyclePhaseLabel(label: string, locale: Locale): string {
  const map = locale === "en" ? PHASE_EN : PHASE_ZH;
  return map[label.trim()] ?? label;
}

const CONFIDENCE_ZH: Record<string, string> = {
  High: "高",
  Medium: "中",
  Low: "低",
};

/** Confidence enum → localized word (EN passthrough; unknown passthrough). */
export function confidenceWord(confidence: string, locale: Locale): string {
  return locale === "en" ? confidence : (CONFIDENCE_ZH[confidence] ?? confidence);
}

// Phase 1b: narrow-context short word for the §6 table cell — "流入/流出"
// instead of the jargon nouns "吸筹/派发" (those still get explained, spelled
// out, in the foot-of-page glossary and the article's intro paragraph).
const AD_SIGNAL_ZH: Record<string, string> = {
  ACCUMULATION: "流入",
  DISTRIBUTION: "流出",
  NEUTRAL: "中性",
};

/** A/D signal enum → localized table-cell word (EN passthrough; unknown passthrough). */
export function adSignalWord(signal: string, locale: Locale): string {
  return locale === "en" ? signal : (AD_SIGNAL_ZH[signal] ?? signal);
}
