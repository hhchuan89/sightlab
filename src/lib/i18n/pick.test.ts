import { describe, it, expect } from "vitest";
import { pick } from "./pick";

/**
 * i18n `pick()` tests (PLAN §15.6, §14-C1 EN-soft-fail).
 *
 * `pick` selects the active locale's prose from a `{ en, zh }` pair. The
 * load-bearing behavior is the FALLBACK: if the requested locale's string is
 * missing or empty (an EN translation hiccup per §14-C1), it must fall back to
 * the other language so the dispatch is never blank — rather than render an empty
 * string and look broken.
 */
describe("pick() locale selection + fallback", () => {
  const full = { en: "English", zh: "中文" };

  it("returns the requested locale when present", () => {
    expect(pick(full, "en")).toBe("English");
    expect(pick(full, "zh")).toBe("中文");
  });

  it("falls back to ZH when EN is empty (EN-soft-fail, §14-C1)", () => {
    expect(pick({ en: "", zh: "中文" }, "en")).toBe("中文");
  });

  it("falls back to ZH when EN is whitespace-only", () => {
    expect(pick({ en: "   ", zh: "中文" }, "en")).toBe("中文");
  });

  it("falls back to EN when ZH is missing for a zh reader", () => {
    expect(pick({ en: "English", zh: "" }, "zh")).toBe("English");
  });

  it("returns empty string only when BOTH languages are empty", () => {
    expect(pick({ en: "", zh: "" }, "en")).toBe("");
    expect(pick({ en: "", zh: "" }, "zh")).toBe("");
  });
});
