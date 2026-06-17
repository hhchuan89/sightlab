/**
 * Ingest body schema — zod validation of the Mac → /api/ingest POST (PLAN §5.2,
 * §7, §14-C1/S1, §15.4).
 *
 * 🔒 PRIVACY (PLAN §15.4, LOCKED — supersedes any earlier contract):
 * The dispatch carries ONLY market-wide §6 (fund flows) + §7 (cycle / dispersion
 * / Weinstein stage + MARKET-STRUCTURE sector judgment). It NEVER carries
 * holdings. This schema:
 *   • defines NO holdings-shaped field at all (no per-position note, no
 *     portfolio-action, no user-ticker bucket, no §8 block), and
 *   • runs a defense-in-depth GUARD (`validateIngestBody`) that REJECTS the whole
 *     body if ANY key anywhere matches /holding|portfolio|持仓/i — so a future
 *     producer that bolts a holdings field onto the payload fails closed (422).
 *
 * Fail-closed bilingual rule (PLAN §14-C1): every prose field is `{ en, zh }` and
 * BOTH must be non-empty → else reject. EXCEPTION: `full_narrative` may be wholly
 * absent/null (weekday), but if present BOTH langs are required. The EN-soft-fail
 * (ship ZH as the EN fallback) is handled on the Mac side BEFORE the POST — by the
 * time a body reaches this schema, EN is already filled (with ZH if translation
 * failed), so both langs are always present here.
 *
 * Schema version (PLAN §14-S1): `schema_version` must equal the version this
 * endpoint understands; an unknown version is rejected.
 */
import { z } from "zod";

/** The only ingest contract version this endpoint accepts (PLAN §14-S1). */
export const INGEST_SCHEMA_VERSION = 1;

// ─────────────────────────── primitives ───────────────────────────

/**
 * A bilingual prose field: BOTH `en` and `zh` required and NON-EMPTY (§14-C1).
 * `.trim()` first so a whitespace-only string counts as empty → reject (422).
 */
const bilingual = z.object({
  en: z.string().trim().min(1, "en must be non-empty"),
  zh: z.string().trim().min(1, "zh must be non-empty"),
});

/** Confidence is a rule-based qualitative label (PLAN §5.1). */
const confidence = z.enum(["High", "Medium", "Low"]);

const adSignal = z.enum(["ACCUMULATION", "DISTRIBUTION", "NEUTRAL"]);

// ─────────────────────────── badge / meta ───────────────────────────

/**
 * cycle_badge is the qualitative stage chip ONLY (PLAN §14-B3): stage + templeton
 * label + confidence. It MUST NOT carry any numeric §7 score (composite_score,
 * composite_precise, dispersion_index, layer totals). `.strict()` rejects any
 * extra key, so a leaked score field fails the schema.
 */
const cycleBadge = z
  .object({
    stage_num: z.number().int(),
    // Bilingual Templeton label (§14-C1): both langs required + non-empty, so the
    // EN UI never leaks the raw Chinese stage string. The Mac maps zh → en before POST.
    templeton_stage: bilingual,
    confidence,
  })
  .strict();

// ─────────────────────────── §6: weekly fund flows ───────────────────────────

const flowRow = z.object({
  etf: z.string().trim().min(1),
  name_zh: z.string().trim().min(1),
  this_week_return_pct: z.number(),
  prev_week_return_pct: z.number(),
  avg_daily_volume: z.number(),
  vol_change_pct: z.number(),
  week_turnover_usd: z.number(),
  ad_signal: adSignal,
  ad_score: z.number(),
  /** P0-3: A/D strength tag (strong/weak/none) + crypto-proxy flag. Optional so
   * older producers still validate; absent → frontend shows no footnote. */
  ad_confidence: z.string().optional(),
  proxy_only: z.boolean().optional(),
  /** table2 per-ETF narrative prose (bilingual, both required). */
  signal: bilingual,
});

const flowsSection6 = z.object({
  table1_markdown: z.string(),
  rows: z.array(flowRow).min(1),
  core_reading: bilingual,
});

// ─────────────────────────── §7: cycle positioning ───────────────────────────

const sectorRow = z.object({
  symbol: z.string().trim().min(1),
  distance_pct: z.number(),
  slope_pct: z.number(),
  weinstein_stage: z.number().int(),
  trend_score: z.number(),
  vol_ratio_5d_20d: z.number(),
  volume_flag: z.string(),
  in_std: z.boolean(),
  /**
   * MARKET-STRUCTURE judgment ONLY (PLAN §15.4): 资金×趋势 commentary, e.g.
   * "tech stage-2 confirmed uptrend; energy distributing". NEVER "what to do
   * with your position". Bilingual, both required.
   */
  judgment: bilingual,
});

const dispersion = z.object({
  dispersion_index: z.number(),
  dispersion_label: bilingual, // §14-C2: the 高/中/低 enum is translated to {zh,en}
  // §5.2 typed this as an int, but the real `query_sector_dispersion.py` emits a
  // STRING span ("S2–S4"). Accept either rather than reject real data.
  stage_spread: z.union([z.number(), z.string()]),
  sector_ranking: z.array(z.string()),
});

const composite = z.object({
  composite_score: z.number(),
  composite_precise: z.number(),
  templeton_stage: z.string().trim().min(1),
  cycle_stage_num: z.number().int(),
  confidence,
  // Server-side mirror of the Mac-side projection, PLAN §15.4 — free-text from
  // the private harness is rejected, not stored.
  confidence_breakdown: z.object({}).strict().default({}),
  contrarian_overlay: z
    .object({
      score: z.number().optional(),
      label: z.string().optional(),
      per_layer: z
        .object({ V: z.number().optional(), S: z.number().optional() })
        .strict()
        .optional(),
    })
    .strict()
    .default({}),
  valuation_a_score: z.number(),
  layer_totals: z.record(z.number()).default({}),
});

// P0/P1/P2 (report 20260614) "alongside" reads — market-only, never holdings.
// Each sub-block is optional (absent on snapshots predating the field); the whole
// block is nullable (a weekday dispatch off an old snapshot may carry nothing).
const cycleExtras = z.object({
  recession_probit_p: z
    .object({ value_pct: z.number(), as_of: z.string().nullable() })
    .optional(),
  yield_curve: z
    .object({
      spread_bps: z.number(),
      level: z.string(),
      trajectory: z.string().nullable(),
      as_of: z.string().nullable(),
    })
    .optional(),
  leading_sleeve: z
    .object({
      tilt: z.string(),
      score: z.number(),
      available_signals: z.number(),
      components: z.record(z.number().nullable()),
    })
    .optional(),
  composite_blockvote: z
    .object({
      rescaled: z.number(),
      implied_stage: bilingual,
      blocks: z.record(z.number()),
    })
    .optional(),
  regime_persistence: z
    .object({
      dwell_snapshots: z.number(),
      direction: bilingual,
      transition_suppressed: z.boolean(),
      hysteresis_smoothed_stage: bilingual,
    })
    .optional(),
});

const cycleSection7 = z.object({
  sectors: z.array(sectorRow).min(1),
  dispersion,
  composite,
  cycle_extras: cycleExtras.nullable().optional().default(null),
  today_core: bilingual,
  // §14-C1: weekly/triggered only — may be wholly null/absent on a weekday, but
  // if PRESENT both langs are required (bilingual enforces that).
  full_narrative: bilingual.nullable().optional().default(null),
});

// ─────────────────────────── full ingest body ───────────────────────────

/**
 * The complete ingest body. `.strict()` at the top level so an unexpected
 * top-level key (e.g. a future `section8` / `portfolio` block) is rejected before
 * the holdings guard even runs — defense in depth.
 */
export const dispatchIngestSchema = z
  .object({
    schema_version: z.literal(INGEST_SCHEMA_VERSION),
    dispatch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dispatch_date must be YYYY-MM-DD"),
    generated_at: z.string().datetime({ offset: true }),
    // Daily (Tue–Sat US-close) vs weekly review (Sun). Defaults to "daily" so a
    // body that predates this field still validates under the .strict() top level.
    kind: z.enum(["daily", "weekly"]).default("daily"),
    // EN-soft-fail marker (PLAN §14-C1): true when EN is a ZH fallback awaiting a
    // real translation on a later re-POST. Content still ships.
    en_pending: z.boolean().optional().default(false),
    // summary prose + badge
    intro: bilingual,
    at_a_glance: bilingual,
    cycle_badge: cycleBadge,
    teaser: bilingual,
    // §6 / §7 (public in v3, same market-only contract)
    flows_section6: flowsSection6,
    cycle_section7: cycleSection7,
  })
  .strict();

export type DispatchIngestBody = z.infer<typeof dispatchIngestSchema>;

// ─────────────────────────── §15.4 holdings guard ───────────────────────────

/**
 * Banned KEY-NAME pattern (PLAN §15.4 defense-in-depth). ANY object key anywhere
 * in the body matching this is a privacy violation → 422. Mirrors the email-side
 * `privacyGuard` but keyed on the broad regex the task pins:
 * /holding|portfolio|持仓/i.
 */
const HOLDINGS_KEY_RE = /holding|portfolio|持仓/i;

/**
 * Deep-scan an arbitrary parsed body for any banned holdings KEY. Returns the
 * dotted paths of every offending key (empty array = clean). Runs on the RAW
 * parsed object BEFORE zod, so even keys zod would strip are caught.
 */
export function findHoldingsKeys(value: unknown, path = ""): string[] {
  const hits: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      hits.push(...findHoldingsKeys(item, `${path}[${i}]`));
    });
    return hits;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (HOLDINGS_KEY_RE.test(key)) hits.push(childPath);
      hits.push(...findHoldingsKeys(child, childPath));
    }
  }

  return hits;
}

export interface IngestParseResult {
  ok: boolean;
  /** Parsed + validated body (only when ok). */
  data?: DispatchIngestBody;
  /** Human-readable rejection reason (only when !ok). */
  error?: string;
}

/**
 * Validate a parsed ingest body: (1) §15.4 holdings KEY guard FIRST (fail closed
 * on any holdings-shaped key, even one zod would otherwise strip), then (2) the
 * zod schema. Returns a discriminated result rather than throwing so the route
 * can map cleanly to 422.
 */
export function validateIngestBody(parsed: unknown): IngestParseResult {
  // (1) PRIVACY guard — defense in depth (PLAN §15.4 LOCKED).
  const holdingsHits = findHoldingsKeys(parsed);
  if (holdingsHits.length > 0) {
    return {
      ok: false,
      error: `PRIVACY VIOLATION (PLAN §15.4): body contains holdings/portfolio keys: ${holdingsHits.join(", ")}`,
    };
  }

  // (2) shape validation (includes §14-C1 fail-closed bilingual + §14-S1 version).
  const result = dispatchIngestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  return { ok: true, data: result.data };
}
