import { describe, it, expect } from "vitest";
import { cyclePhaseLabel } from "./displayWords";

/**
 * Phase1 task A (2026-07-18, top-blindness audit): the harness added a new
 * Templeton phase label — "still extreme but slipping off the euphoria high"
 * — this locks the new mapping so the badge never renders the raw enum string
 * to a reader (falling back to the raw label would leak an unlocalized ZH
 * string into the EN UI, or an un-"Phase"-ified "Stage" string into ZH).
 */
describe("cyclePhaseLabel — Stage 4 euphoria fading (caution)", () => {
  it("maps the EN 'Stage' wording to 'Phase' wording", () => {
    expect(cyclePhaseLabel("Stage 4 euphoria fading (caution)", "en")).toBe(
      "Phase 4 euphoria fading (caution)",
    );
  });

  it("maps the raw ZH harness label to the '第 N 期' wording", () => {
    expect(cyclePhaseLabel("阶段 4 亢奋·回落（警惕）", "zh")).toBe("第 4 期 亢奋·回落（警惕）");
  });

  it("passes through unknown labels unchanged (producer drift degrades, never crashes)", () => {
    expect(cyclePhaseLabel("some new unmapped label", "en")).toBe("some new unmapped label");
  });
});
