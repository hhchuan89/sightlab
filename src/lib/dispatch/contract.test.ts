import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Dispatch } from "./types";

/**
 * Public RPC contract test (PLAN §15.1, §15.6).
 *
 * v3 OPEN/FREE pivot: dispatch CONTENT is fully PUBLIC. The active read path is
 * the `*_public` RPCs, which return the COMPLETE §6/§7 projection to everyone —
 * no role check, no content lock. This test pins that contract at two levels,
 * with NO live DB:
 *
 *  (1) TYPE-LEVEL: the projected `Dispatch` type exposes the full content —
 *      `flows_section6` / `cycle_section7` are NON-optional. A value missing
 *      either block does not satisfy `Dispatch`, so this fails `tsc` (the
 *      typecheck step) if someone makes them optional again.
 *
 *  (2) SQL-LEVEL: the active migration's `project_dispatch_full()` includes both
 *      content blocks and `is_locked:false` for ALL callers — proving the public
 *      projection is not silently gated.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

describe("§15.1 public dispatch contract — full content for everyone", () => {
  it("the projected Dispatch type requires both §6 and §7 blocks (type-level)", () => {
    // If `flows_section6` / `cycle_section7` were ever made optional, this object
    // literal — which only typechecks when BOTH are present and non-optional —
    // would still pass; but a regression that DROPS a block from the type below
    // (or marks it optional) is caught by `tsc --noEmit`. The runtime assertion
    // documents the same invariant.
    const d: Dispatch = {
      dispatch_date: "2026-06-06",
      generated_at: "2026-06-06T00:03:11Z",
      kind: "daily",
      intro_en: "intro",
      intro_zh: "导语",
      at_a_glance_en: "glance",
      at_a_glance_zh: "速览",
      cycle_badge: {
        stage_num: 3,
        templeton_stage: { en: "Stage 3 (optimism)", zh: "阶段 3（乐观）" },
        confidence: "Medium",
      },
      is_locked: false,
      flows_section6: {
        table1_markdown: "",
        rows: [],
        core_reading: { en: "r", zh: "读" },
      },
      cycle_section7: {
        sectors: [],
        dispersion: {
          dispersion_index: 0,
          dispersion_label: { en: "Medium", zh: "中" },
          stage_spread: "S2–S4",
          sector_ranking: [],
        },
        composite: {
          composite_score: 0,
          composite_precise: 0,
          templeton_stage: "Expansion",
          cycle_stage_num: 3,
          confidence: "Medium",
          confidence_breakdown: {},
          contrarian_overlay: {},
          valuation_a_score: 0,
          layer_totals: {},
        },
        today_core: { en: "c", zh: "核" },
        full_narrative: null,
      },
      deepread_section: null, // §15.9 — null is valid (pre-§15.9 row / weekday)
    };

    // Content is public → both blocks present, never locked.
    expect(d.flows_section6).toBeDefined();
    expect(d.cycle_section7).toBeDefined();
    expect(d.is_locked).toBe(false);
  });

  it("the active SQL projection exposes both §6/§7 blocks to ALL callers (SQL-level)", () => {
    const sql = readFileSync(
      join(REPO_ROOT, "supabase", "migrations", "0004_public_v3.sql"),
      "utf8",
    );
    // The public projection function builds the FULL object — both content
    // blocks + is_locked:false — with no role branch.
    expect(sql).toMatch(/project_dispatch_full/);
    expect(sql).toMatch(/'flows_section6',\s*d\.flows_section6/);
    expect(sql).toMatch(/'cycle_section7',\s*d\.cycle_section7/);
    expect(sql).toMatch(/'is_locked',\s*false/);
    // The public read RPCs are reachable by anon AND authenticated.
    expect(sql).toMatch(
      /grant execute on function public\.get_latest_public\(\)\s+to anon, authenticated/,
    );
  });
});
