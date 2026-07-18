import { describe, it, expect } from "vitest";
import {
  validateIngestBody,
  findHoldingsKeys,
  dispatchIngestSchema,
  INGEST_SCHEMA_VERSION,
} from "./schema";

/**
 * Ingest-schema tests (PLAN §15.4 PRIVACY guard + §14-C1 fail-closed bilingual).
 *
 * Pure schema/function tests — no live DB. These are the committed enforcement of
 * the LOCKED privacy rule: the dispatch carries ONLY market-wide §6/§7 and NEVER
 * holdings. If a future producer bolts a holdings field onto the payload, or lets
 * an English prose field go empty, the schema fails closed (422) and these tests
 * turn red.
 */

/** A clean, market-only §6/§7 body — the shape the schema must ACCEPT. */
function cleanBody(): Record<string, unknown> {
  return {
    schema_version: INGEST_SCHEMA_VERSION,
    dispatch_date: "2026-06-06",
    generated_at: "2026-06-06T00:03:11Z",
    intro: { en: "Tech accumulates while energy bleeds.", zh: "科技吸筹，能源失血。" },
    at_a_glance: { en: "Stage 3 expansion, medium confidence.", zh: "阶段3扩张，中等置信度。" },
    cycle_badge: {
      stage_num: 3,
      templeton_stage: { en: "Stage 3 (optimism)", zh: "阶段 3（乐观）" },
      confidence: "Medium",
    },
    teaser: { en: "Cycle holds at Stage 3.", zh: "周期维持在阶段3。" },
    flows_section6: {
      table1_markdown: "| ETF | wk |\n|---|---|\n| XLK | 1.42 |",
      rows: [
        {
          etf: "XLK",
          name_zh: "科技",
          this_week_return_pct: 1.42,
          prev_week_return_pct: 0.3,
          avg_daily_volume: 0,
          vol_change_pct: 0,
          week_turnover_usd: 0,
          ad_signal: "ACCUMULATION",
          ad_score: 0.62,
          signal: { en: "Steady accumulation.", zh: "稳定吸筹。" },
        },
      ],
      core_reading: { en: "Leadership narrows into tech.", zh: "领导地位向科技收窄。" },
    },
    cycle_section7: {
      sectors: [
        {
          symbol: "XLK",
          distance_pct: 7.8,
          slope_pct: 0.9,
          weinstein_stage: 2,
          trend_score: 0,
          vol_ratio_5d_20d: 1.1,
          volume_flag: "confirmed_breakout",
          in_std: true,
          judgment: {
            en: "Tech stage-2 confirmed uptrend.",
            zh: "科技处于第2阶段确认上行。",
          },
        },
      ],
      dispersion: {
        dispersion_index: 4.6,
        dispersion_label: { en: "Medium", zh: "中" },
        stage_spread: "S2–S4",
        sector_ranking: ["XLK", "SMH"],
      },
      composite: {
        composite_score: -1,
        composite_precise: -0.74,
        templeton_stage: "Expansion",
        cycle_stage_num: 3,
        confidence: "Medium",
        confidence_breakdown: {},
        contrarian_overlay: {},
        valuation_a_score: 0,
        layer_totals: {},
      },
      today_core: { en: "Regime unchanged week over week.", zh: "格局周环比未变。" },
      full_narrative: null,
    },
  };
}

describe("§15.4 PRIVACY guard — holdings keys are rejected", () => {
  it("ACCEPTS a clean market-only §6/§7 body", () => {
    const result = validateIngestBody(cleanBody());
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.data?.cycle_section7.sectors[0].symbol).toBe("XLK");
  });

  it("REJECTS a body with a top-level `portfolio` block", () => {
    const body = { ...cleanBody(), portfolio: { positions: ["XOM", "KO"] } };
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PRIVACY VIOLATION/);
    expect(result.error).toMatch(/portfolio/);
  });

  it("REJECTS a nested `holding_note` field on a §7 sector", () => {
    const body = cleanBody();
    const sectors = (body.cycle_section7 as { sectors: Record<string, unknown>[] }).sectors;
    sectors[0].holding_note = { en: "trim your XLK", zh: "减一点 XLK" };
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PRIVACY VIOLATION/);
    expect(result.error).toMatch(/holding_note/);
  });

  it("REJECTS the Chinese 持仓 key anywhere in the body", () => {
    const body = cleanBody();
    (body.cycle_section7 as Record<string, unknown>).持仓 = "XOM 满仓";
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PRIVACY VIOLATION/);
  });

  it("findHoldingsKeys reports the dotted path of every offending key", () => {
    const hits = findHoldingsKeys({
      flows_section6: { rows: [{ etf: "XLK", portfolio_action: "buy" }] },
      holdings: ["x"],
    });
    expect(hits).toContain("holdings");
    expect(hits).toContain("flows_section6.rows[0].portfolio_action");
  });
});

describe("§14-C1 fail-closed bilingual — empty EN prose is rejected", () => {
  it("REJECTS when intro.en is an empty string", () => {
    const body = cleanBody();
    (body.intro as Record<string, string>).en = "";
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/intro\.en/);
  });

  it("REJECTS when a whitespace-only EN slips into a §6 per-ETF signal", () => {
    const body = cleanBody();
    const rows = (body.flows_section6 as { rows: Record<string, unknown>[] }).rows;
    (rows[0].signal as Record<string, string>).en = "   ";
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/en must be non-empty/);
  });

  it("REJECTS an unknown schema_version (§14-S1)", () => {
    const body = { ...cleanBody(), schema_version: 999 };
    expect(dispatchIngestSchema.safeParse(body).success).toBe(false);
  });
});

describe("cycle_badge.tension — optional flows-vs-structure warning (task D, 2026-07-18)", () => {
  it("ACCEPTS a clean body WITHOUT tension (ordinary day, and every archived dispatch)", () => {
    const body = cleanBody();
    expect((body.cycle_badge as Record<string, unknown>).tension).toBeUndefined();
    const result = validateIngestBody(body);
    expect(result.ok).toBe(true);
    expect(result.data?.cycle_badge?.tension).toBeUndefined();
  });

  it("ACCEPTS a body WITH a valid tension pair", () => {
    const body = cleanBody();
    (body.cycle_badge as Record<string, unknown>).tension = {
      en: "money leaving while structure holds (strong distribution in 2 sectors)",
      zh: "资金逆结构撤离(强派发 2 个板块)",
    };
    const result = validateIngestBody(body);
    expect(result.ok).toBe(true);
    expect(result.data?.cycle_badge?.tension?.zh).toMatch(/资金逆结构撤离/);
  });

  it("REJECTS tension with an empty EN string (§14-C1 fail-closed bilingual still applies)", () => {
    const body = cleanBody();
    (body.cycle_badge as Record<string, unknown>).tension = { en: "", zh: "资金逆结构撤离" };
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
  });
});

describe("§15.9 deepread_section — additive, optional, still privacy-guarded", () => {
  const deepread = {
    teaser: { en: "Cycle holds, leaders thinning on volume.", zh: "周期维持,领涨缩量。" },
    body: {
      en: "Stage 2/3. Strong distribution in energy.\n\nThis is a confirmer, not a forecast.",
      zh: "阶段2/3。能源强派发。\n\n这是确认信号,不是预测。",
    },
  };

  it("ACCEPTS a clean body WITHOUT deepread_section (pre-§15.9 producer, schema_version unchanged)", () => {
    const body = cleanBody();
    expect(body.deepread_section).toBeUndefined();
    const result = validateIngestBody(body);
    expect(result.ok).toBe(true);
    // default → null when absent
    expect(result.data?.deepread_section).toBeNull();
  });

  it("ACCEPTS a clean body WITH a valid deepread_section", () => {
    const body = { ...cleanBody(), deepread_section: deepread };
    const result = validateIngestBody(body);
    expect(result.ok).toBe(true);
    expect(result.data?.deepread_section?.teaser.zh).toMatch(/周期维持/);
  });

  it("REJECTS when deepread_section.body.en is empty (§14-C1 fail-closed bilingual)", () => {
    const body = {
      ...cleanBody(),
      deepread_section: { ...deepread, body: { en: "", zh: deepread.body.zh } },
    };
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/deepread_section\.body\.en/);
  });

  it("REJECTS a holdings key smuggled INTO deepread_section (§15.4 guard scans it)", () => {
    const body = {
      ...cleanBody(),
      deepread_section: { ...deepread, holding_note: { en: "trim XLK", zh: "减 XLK" } },
    };
    const result = validateIngestBody(body);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PRIVACY VIOLATION/);
    expect(result.error).toMatch(/holding_note/);
  });
});
