#!/usr/bin/env python3
"""Unit tests for assemble_dispatch.py — currently the Flows×Cycle cross
(build_cross_paragraph + its deep-read/teaser wiring; plan 20260703_01).

Run:  python3 scripts/mac/test_assemble_dispatch.py
(pure functions, no network, no harness inputs needed)
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest

_HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("assemble_dispatch", _HERE / "assemble_dispatch.py")
ad = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ad)


def row(etf: str, name_zh: str, signal: str, conf: str) -> dict:
    return {"etf": etf, "name_zh": name_zh, "ad_signal": signal, "ad_confidence": conf}


def sector(symbol: str, stage: int) -> dict:
    return {"symbol": symbol, "weinstein_stage": stage}


def cross(rows: list[dict], sectors: list[dict]) -> dict:
    return ad.build_cross_paragraph({"rows": rows}, {"sectors": sectors})


# One §6/§7 pair per cell: (signal, stage, warning, zh key-phrase, en key-phrase).
# Phase 1b (2026-07-18 plain-ZH rewrite): key-phrases updated to the new plain
# wording ("高可信度"/"资金流入/流出" instead of "强信号"/"吸筹/派发"); the
# underlying trigger conditions (signal × stage → cell) are unchanged.
CELL_CASES = [
    ("DISTRIBUTION", 2, True, "这可能是真撤离", "This could be a real exit"),
    ("ACCUMULATION", 3, True, "这更像是追高接盘", "reads more like chasing strength"),
    ("ACCUMULATION", 2, False, "这轮涨势有资金撑腰", "the advance has real backing"),
    ("DISTRIBUTION", 3, False, "这更像是真实的卖出", "reads as real selling rather than profit-taking"),
    ("DISTRIBUTION", 4, False, "趋势和资金方向一致,互相确认", "trend and flows agree"),
    ("ACCUMULATION", 1, False, "教科书式的筑底吸筹", "the textbook accumulation pattern"),
    ("DISTRIBUTION", 1, False, "让筑底的判断打上问号", "puts the basing read in doubt"),
    ("ACCUMULATION", 4, False, "可信度最低的组合", "the lowest-confidence combination"),
]


class TestCrossCells(unittest.TestCase):
    def test_each_cell_fires_with_expected_reading(self) -> None:
        for signal, stage, warning, zh_key, en_key in CELL_CASES:
            with self.subTest(signal=signal, stage=stage):
                out = cross([row("XLK", "科技", signal, "strong")], [sector("XLK", stage)])
                self.assertIn(zh_key, out["zh"])
                self.assertIn(en_key, out["en"])
                self.assertIn("XLK(科技)", out["zh"])
                self.assertIn("XLK", out["en"])
                self.assertEqual(out["warning"], warning)
                self.assertTrue(out["zh"].startswith("资金×结构交叉:"))
                self.assertTrue(out["en"].startswith("Flows×Cycle cross: "))

    def test_empty_when_no_strong_signal(self) -> None:
        out = cross(
            [row("XLK", "科技", "ACCUMULATION", "weak"), row("XLE", "能源", "NEUTRAL", "none")],
            [sector("XLK", 2), sector("XLE", 4)],
        )
        self.assertEqual(out["zh"], ad._CROSS_EMPTY_ZH)
        self.assertEqual(out["en"], ad._CROSS_EMPTY_EN)
        self.assertFalse(out["warning"])

    def test_weak_confidence_never_fires(self) -> None:
        out = cross([row("XLK", "科技", "DISTRIBUTION", "weak")], [sector("XLK", 2)])
        self.assertEqual(out["zh"], ad._CROSS_EMPTY_ZH)

    def test_strong_neutral_never_fires(self) -> None:
        out = cross([row("XLK", "科技", "NEUTRAL", "strong")], [sector("XLK", 2)])
        self.assertEqual(out["zh"], ad._CROSS_EMPTY_ZH)

    def test_index_and_crypto_rows_drop_out_of_the_join(self) -> None:
        # SPY/QQQ/IBIT/FBTC have no §7 sector row → the cross cannot run on them,
        # even at strong confidence (skill §C2: both facts must be held).
        out = cross(
            [
                row("SPY", "标普500", "DISTRIBUTION", "strong"),
                row("IBIT", "贝莱德比特币ETF", "ACCUMULATION", "strong"),
            ],
            [sector("XLK", 2)],
        )
        self.assertEqual(out["zh"], ad._CROSS_EMPTY_ZH)
        self.assertFalse(out["warning"])
        # positive control: a joinable sector in the SAME batch still fires, and the
        # non-joinable rows stay out of the text (guards against a dead join passing)
        out2 = cross(
            [
                row("SPY", "标普500", "DISTRIBUTION", "strong"),
                row("IBIT", "贝莱德比特币ETF", "ACCUMULATION", "strong"),
                row("XLE", "能源", "DISTRIBUTION", "strong"),
            ],
            [sector("XLE", 2)],
        )
        self.assertIn("XLE(能源)", out2["zh"])
        self.assertTrue(out2["warning"])
        self.assertNotIn("SPY", out2["zh"])
        self.assertNotIn("SPY", out2["en"])
        self.assertNotIn("IBIT", out2["en"])

    def test_unknown_stage_drops_out(self) -> None:
        out = cross([row("XLK", "科技", "DISTRIBUTION", "strong")], [sector("XLK", 0)])
        self.assertEqual(out["zh"], ad._CROSS_EMPTY_ZH)

    def test_same_cell_aggregates_names_into_one_sentence(self) -> None:
        out = cross(
            [row("XLV", "医疗", "ACCUMULATION", "strong"), row("XLP", "必需消费", "ACCUMULATION", "strong")],
            [sector("XLV", 1), sector("XLP", 1)],
        )
        self.assertIn("XLV(医疗)、XLP(必需消费)", out["zh"])
        self.assertIn("XLV and XLP", out["en"])
        # one cell → exactly one occurrence of the cell's reading
        self.assertEqual(out["zh"].count("教科书式的筑底吸筹"), 1)

    def test_en_name_join_is_prose_safe(self) -> None:
        self.assertEqual(ad._cross_names_en(["XLE"]), "XLE")
        self.assertEqual(ad._cross_names_en(["XLF", "XLV"]), "XLF and XLV")
        self.assertEqual(ad._cross_names_en(["XLF", "XLV", "XLP"]), "XLF, XLV, and XLP")

    def test_warning_cell_renders_before_confirmation_cell(self) -> None:
        out = cross(
            [
                row("XLV", "医疗", "ACCUMULATION", "strong"),  # ACC×S2 confirmation
                row("XLE", "能源", "DISTRIBUTION", "strong"),  # DIST×S2 warning
            ],
            [sector("XLV", 2), sector("XLE", 2)],
        )
        self.assertLess(out["zh"].index("XLE(能源)"), out["zh"].index("XLV(医疗)"))
        self.assertLess(out["en"].index("XLE"), out["en"].index("XLV"))
        self.assertTrue(out["warning"])

    def test_full_priority_order_warnings_then_contrarian_last(self) -> None:
        # warning1 (DIST×S2) → warning2 (ACC×S3) → contrarian (ACC×S4) last
        out = cross(
            [
                row("XLU", "公用", "ACCUMULATION", "strong"),  # ACC×S4 contrarian
                row("XLF", "金融", "ACCUMULATION", "strong"),  # ACC×S3 warning2
                row("XLE", "能源", "DISTRIBUTION", "strong"),  # DIST×S2 warning1
            ],
            [sector("XLU", 4), sector("XLF", 3), sector("XLE", 2)],
        )
        i_w1 = out["zh"].index("XLE(能源)")
        i_w2 = out["zh"].index("XLF(金融)")
        i_ct = out["zh"].index("XLU(公用)")
        self.assertLess(i_w1, i_w2)
        self.assertLess(i_w2, i_ct)

    def test_overflow_beyond_cap_compresses_into_listing_line(self) -> None:
        # 4 distinct cells fire → first 3 (both warnings + top confirmation) render
        # in full, the 4th (contrarian, lowest priority) compresses into the honest
        # listing line — named, never silently dropped, full template absent.
        out = cross(
            [
                row("XLE", "能源", "DISTRIBUTION", "strong"),  # DIST×S2 warning1
                row("XLF", "金融", "ACCUMULATION", "strong"),  # ACC×S3 warning2
                row("XLV", "医疗", "ACCUMULATION", "strong"),  # ACC×S2 confirmation
                row("XLU", "公用", "ACCUMULATION", "strong"),  # ACC×S4 contrarian → overflow
            ],
            [sector("XLE", 2), sector("XLF", 3), sector("XLV", 2), sector("XLU", 4)],
        )
        self.assertIn("其余高可信度交叉本期仅列不展:XLU(公用,流入×阶段4)。", out["zh"])
        self.assertIn("Further crosses this week, listed but not unpacked: XLU (accumulation × stage 4).", out["en"])
        self.assertNotIn("可信度最低的组合", out["zh"])  # the full contrarian template did NOT render
        self.assertTrue(out["warning"])

    def test_data_gap_sector_drop_shouts_to_stderr(self) -> None:
        import contextlib
        import io

        # a REAL sector fires strong but its §7 stage is missing → stderr warning;
        # SPY (known non-sector) stays silent; the honest empty line still holds.
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf):
            out = cross(
                [
                    row("XLE", "能源", "DISTRIBUTION", "strong"),
                    row("SPY", "标普500", "DISTRIBUTION", "strong"),
                ],
                [sector("XLE", 0)],  # stage missing upstream
            )
        err = buf.getvalue()
        self.assertIn("dropped strong sector row XLE", err)
        self.assertNotIn("SPY", err)
        self.assertEqual(out["zh"], ad._CROSS_EMPTY_ZH)


def minimal_cycle7(sectors: list[dict]) -> dict:
    return {
        "sectors": sectors,
        "dispersion": {"dispersion_label": {"zh": "中", "en": "Medium"}},
        "composite": {
            "templeton_stage": "阶段 3（乐观）",
            "confidence": "High",
            "valuation_a_score": -1.0,
            "cycle_stage_num": 3,
            "composite_score": 1.0,
        },
        "cycle_extras": None,
    }


def minimal_flows6(rows: list[dict]) -> dict:
    full_rows = [
        {**r, "this_week_return_pct": 0.5, "vol_change_pct": 0.0} for r in rows
    ]
    return {"rows": full_rows}


class TestDeepreadWiring(unittest.TestCase):
    def test_cross_paragraph_sits_between_flows_and_transition(self) -> None:
        flows6 = minimal_flows6([row("XLE", "能源", "DISTRIBUTION", "strong")])
        cycle7 = minimal_cycle7([sector("XLE", 2)])
        deep = ad.build_deepread_section(flows6, cycle7)
        body = deep["body"]["zh"]
        self.assertIn("资金×结构交叉:", body)
        self.assertLess(body.index("资金面:"), body.index("资金×结构交叉:"))
        self.assertIn("Flows×Cycle cross:", deep["body"]["en"])

    def test_cross_renders_before_p3_transition_paragraph(self) -> None:
        # p3 fires only on a suppressed transition — pin cross (p2.5) BEFORE it.
        flows6 = minimal_flows6([row("XLE", "能源", "DISTRIBUTION", "strong")])
        cycle7 = minimal_cycle7([sector("XLE", 2)])
        cycle7["cycle_extras"] = {
            "regime_persistence": {
                "transition_suppressed": True,
                "hysteresis_smoothed_stage": {"zh": "阶段 2/3 过渡", "en": "Stage 2/3 transition"},
                "direction": {"zh": "↑ 上行", "en": "↑ rising"},
                "dwell_snapshots": 1,
            }
        }
        deep = ad.build_deepread_section(flows6, cycle7)
        body = deep["body"]["zh"]
        self.assertIn("档位状态(", body)  # p3 present
        self.assertLess(body.index("资金×结构交叉:"), body.index("档位状态("))

    def test_teaser_hook_fires_on_warning_cell_only(self) -> None:
        warn_flows = minimal_flows6([row("XLE", "能源", "DISTRIBUTION", "strong")])
        calm_flows = minimal_flows6([row("XLE", "能源", "DISTRIBUTION", "weak")])
        cycle7 = minimal_cycle7([sector("XLE", 2)])
        warn = ad.build_deepread_section(warn_flows, cycle7)
        calm = ad.build_deepread_section(calm_flows, cycle7)
        self.assertIn("资金与结构出现交叉张力", warn["teaser"]["zh"])
        self.assertIn("flows and structure are crossing in tension", warn["teaser"]["en"])
        self.assertNotIn("资金与结构出现交叉张力", calm["teaser"]["zh"])
        self.assertNotIn("crossing in tension", calm["teaser"]["en"])

    def test_confirmation_cell_does_not_hook_teaser(self) -> None:
        flows6 = minimal_flows6([row("XLV", "医疗", "ACCUMULATION", "strong")])
        cycle7 = minimal_cycle7([sector("XLV", 2)])
        deep = ad.build_deepread_section(flows6, cycle7)
        self.assertIn("资金×结构交叉:", deep["body"]["zh"])  # cross renders…
        self.assertNotIn("资金与结构出现交叉张力", deep["teaser"]["zh"])  # …but no alarm hook

    def test_empty_cross_still_renders_the_honest_empty_line(self) -> None:
        flows6 = minimal_flows6([row("XLK", "科技", "NEUTRAL", "none")])
        cycle7 = minimal_cycle7([sector("XLK", 2)])
        deep = ad.build_deepread_section(flows6, cycle7)
        self.assertIn(ad._CROSS_EMPTY_ZH, deep["body"]["zh"])
        self.assertIn(ad._CROSS_EMPTY_EN, deep["body"]["en"])

    def test_no_holdings_key_anywhere(self) -> None:
        flows6 = minimal_flows6([row("XLE", "能源", "DISTRIBUTION", "strong")])
        cycle7 = minimal_cycle7([sector("XLE", 2)])
        deep = ad.build_deepread_section(flows6, cycle7)
        ad.assert_no_holdings(deep)  # dies (SystemExit) on violation


def global_proxy(symbol: str, market_zh: str, stage: int, dd_pct: float,
                  pressure_flag: str | None = None) -> dict:
    return {
        "symbol": symbol, "market_zh": market_zh, "weinstein_stage": stage,
        "drawdown_from_52w_high_pct": dd_pct, "pressure_flag": pressure_flag,
    }


class TestGlobalTapeParagraph(unittest.TestCase):
    """Task 3 (2026-07-19 phase2): §7 deep-read global-market overlay paragraph."""

    def test_empty_list_renders_nothing(self) -> None:
        out = ad.build_global_tape_paragraph([])
        self.assertEqual(out, {"zh": "", "en": ""})

    def test_none_renders_nothing(self) -> None:
        # older dispersion.json without the global_tape key at all
        out = ad.build_global_tape_paragraph(None)
        self.assertEqual(out, {"zh": "", "en": ""})

    def test_all_calm_same_stage_no_flags(self) -> None:
        tape = [global_proxy("EWJ", "日本", 2, -3.0), global_proxy("FEZ", "欧元区", 2, -2.0)]
        out = ad.build_global_tape_paragraph(tape)
        self.assertIn("大体同向", out["zh"])
        self.assertNotIn("为什么值得看", out["zh"])  # no flagged market → no bellwether line
        self.assertIn("broadly in the same trend state", out["en"])

    def test_flags_stage4_and_pressure_markets_by_name(self) -> None:
        tape = [
            global_proxy("EWY", "韩国", 2, -25.85, pressure_flag="s2_climax_selloff"),
            global_proxy("MCHI", "中国", 4, -20.96),
            global_proxy("EWJ", "日本", 2, -6.68),
        ]
        out = ad.build_global_tape_paragraph(tape)
        self.assertIn("韩国(EWY)", out["zh"])
        self.assertIn("中国(MCHI)", out["zh"])
        self.assertNotIn("日本(EWJ)", out["zh"])  # calm S2, no pressure flag → not called out
        self.assertIn("为什么值得看", out["zh"])
        self.assertIn("supply chain", out["en"])

    def test_state_description_not_forecast_wording(self) -> None:
        # §D3/writing-craft guard: "常早于" (has often preceded) is a past-tense
        # fact; "将预示"/"will foreshadow" (a forecast claim) must never appear.
        tape = [global_proxy("EWY", "韩国", 4, -25.0)]
        out = ad.build_global_tape_paragraph(tape)
        self.assertIn("常常早于", out["zh"])
        self.assertNotIn("将预示", out["zh"])
        self.assertNotIn("will foreshadow", out["en"])

    def test_wired_into_deepread_body_after_cycle_position(self) -> None:
        flows6 = minimal_flows6([row("XLK", "科技", "NEUTRAL", "none")])
        cycle7 = minimal_cycle7([sector("XLK", 2)])
        tape = [global_proxy("MCHI", "中国", 4, -20.0)]
        deep = ad.build_deepread_section(flows6, cycle7, tape)
        body = deep["body"]["zh"]
        self.assertIn("全球盘面 overlay", body)
        self.assertLess(body.index("周期定位:"), body.index("全球盘面 overlay"))

    def test_no_global_tape_arg_defaults_to_no_paragraph(self) -> None:
        # backward compatible: existing callers (and tests) omit the arg.
        flows6 = minimal_flows6([row("XLK", "科技", "NEUTRAL", "none")])
        cycle7 = minimal_cycle7([sector("XLK", 2)])
        deep = ad.build_deepread_section(flows6, cycle7)
        self.assertNotIn("全球盘面 overlay", deep["body"]["zh"])


class TestCycleBadgeTension(unittest.TestCase):
    """task D (2026-07-18 audit fix F4): cycle_badge.tension escalates the
    flows-vs-structure warning that build_cross_paragraph already renders in
    prose — reusing the same join (_flow_structure_cells), not a second copy
    of the "strong DISTRIBUTION × stage 2" check."""

    def test_two_sectors_fire_tension(self) -> None:
        flows6 = minimal_flows6(
            [
                row("XLE", "能源", "DISTRIBUTION", "strong"),
                row("XLF", "金融", "DISTRIBUTION", "strong"),
            ]
        )
        cycle7 = minimal_cycle7([sector("XLE", 2), sector("XLF", 2)])
        out = ad.build_free_slice(flows6, cycle7)
        self.assertIn("tension", out["cycle_badge"])
        self.assertIn("2 个板块", out["cycle_badge"]["tension"]["zh"])
        self.assertIn("2 sectors", out["cycle_badge"]["tension"]["en"])
        self.assertIn("⚠️", out["at_a_glance"]["zh"])
        self.assertIn("money leaving while structure holds", out["at_a_glance"]["en"])
        self.assertIn("⚠️", out["intro"]["zh"])

    def test_one_sector_below_threshold_no_tension(self) -> None:
        flows6 = minimal_flows6([row("XLE", "能源", "DISTRIBUTION", "strong")])
        cycle7 = minimal_cycle7([sector("XLE", 2)])
        out = ad.build_free_slice(flows6, cycle7)
        self.assertNotIn("tension", out["cycle_badge"])
        self.assertNotIn("⚠️", out["at_a_glance"]["zh"])

    def test_distribution_at_stage_3_does_not_count_as_tension(self) -> None:
        # DISTRIBUTION + stage 3 is a CONFIRMATION cell in the cross (top +
        # volume corroborating each other), not "structure still holds" — must
        # not be miscounted into the stage-2 tension bucket.
        flows6 = minimal_flows6(
            [
                row("XLE", "能源", "DISTRIBUTION", "strong"),
                row("XLF", "金融", "DISTRIBUTION", "strong"),
            ]
        )
        cycle7 = minimal_cycle7([sector("XLE", 3), sector("XLF", 3)])
        out = ad.build_free_slice(flows6, cycle7)
        self.assertNotIn("tension", out["cycle_badge"])

    def test_weak_confidence_does_not_count(self) -> None:
        flows6 = minimal_flows6(
            [
                row("XLE", "能源", "DISTRIBUTION", "weak"),
                row("XLF", "金融", "DISTRIBUTION", "weak"),
            ]
        )
        cycle7 = minimal_cycle7([sector("XLE", 2), sector("XLF", 2)])
        out = ad.build_free_slice(flows6, cycle7)
        self.assertNotIn("tension", out["cycle_badge"])

    def test_cycle_badge_stays_strict_schema_compatible_shape_when_absent(self) -> None:
        # no accidental empty/null "tension" key when the condition doesn't fire —
        # schema.ts's cycle_badge is .strict(), the key must be truly ABSENT.
        flows6 = minimal_flows6([row("XLK", "科技", "NEUTRAL", "none")])
        cycle7 = minimal_cycle7([sector("XLK", 2)])
        out = ad.build_free_slice(flows6, cycle7)
        self.assertNotIn("tension", out["cycle_badge"].keys())


def raw_dispersion_sector(symbol: str, **overrides: object) -> dict:
    """One `dispersion.json` sectors[symbol] row — the raw harness shape
    build_cycle_section7 consumes (not the minimal_cycle7 test fixture)."""
    base = {
        "symbol": symbol,
        "sector_zh": symbol,
        "distance_pct": 5.0,
        "slope_pct": 1.0,
        "weinstein_stage": 2,
        "weinstein_label": "上行",
        "trend_score": 3,
        "vol_ratio_5d_20d": 1.0,
        "volume_flag": "",
        "in_std": True,
    }
    base.update(overrides)
    return base


def minimal_raw_dispersion(sectors: dict) -> dict:
    return {
        "sectors": sectors,
        "dispersion_label": "中",
        "dispersion_index": 4.0,
        "stage_spread": "S2–S4",
        "sector_ranking": list(sectors.keys()),
    }


def minimal_raw_fast() -> dict:
    return {
        "snapshot_reference": {
            "composite_score": 1.0,
            "templeton_stage": "阶段 3（乐观）",
            "cycle_stage_num": 3,
            "confidence": "Medium",
            "contrarian_overlay": {},
            "valuation_a": {"score": 0},
        },
        "live_layers_raw": {},
    }


class TestSectorPressureFields(unittest.TestCase):
    """Phase 1 (2026-07-18 audit) 52-week drawdown/pressure fields: the
    rendering fix (2026-07-19) that transparently pass-throughs
    drawdown_from_52w_high_pct/pressure_flag and appends the plain-language
    caveat clause to the §7 judgment sentence."""

    def test_pressure_flag_absent_on_old_data_yields_none_fields_and_no_caveat(self) -> None:
        # Pre-Phase-1 dispersion.json rows simply don't have the keys.
        sectors = {"XLK": raw_dispersion_sector("XLK")}
        out = ad.build_cycle_section7(minimal_raw_dispersion(sectors), minimal_raw_fast())
        row = out["sectors"][0]
        self.assertIsNone(row["drawdown_from_52w_high_pct"])
        self.assertIsNone(row["pressure_flag"])
        self.assertNotIn("距52周高点", row["judgment"]["zh"])
        self.assertNotIn("52-week high", row["judgment"]["en"])

    def test_s2_under_pressure_appends_zh_en_caveat_with_the_real_number(self) -> None:
        sectors = {
            "SMH": raw_dispersion_sector(
                "SMH",
                drawdown_from_52w_high_pct=-16.8,
                pressure_flag="s2_under_pressure",
            )
        }
        out = ad.build_cycle_section7(minimal_raw_dispersion(sectors), minimal_raw_fast())
        row = out["sectors"][0]
        self.assertEqual(row["drawdown_from_52w_high_pct"], -16.8)
        self.assertEqual(row["pressure_flag"], "s2_under_pressure")
        self.assertIn("距52周高点已回落16.8%", row["judgment"]["zh"])
        self.assertIn('"趋势未破、价格已明显受压"', row["judgment"]["zh"])
        self.assertIn("16.8% off its 52-week high", row["judgment"]["en"])
        self.assertIn("trend intact, price under visible pressure", row["judgment"]["en"])

    def test_s2_climax_selloff_uses_the_climax_wording(self) -> None:
        sectors = {
            "XLE": raw_dispersion_sector(
                "XLE",
                drawdown_from_52w_high_pct=-22.4,
                pressure_flag="s2_climax_selloff",
            )
        }
        out = ad.build_cycle_section7(minimal_raw_dispersion(sectors), minimal_raw_fast())
        row = out["sectors"][0]
        self.assertEqual(row["pressure_flag"], "s2_climax_selloff")
        self.assertIn("距52周高点已回落22.4%,且下跌放量", row["judgment"]["zh"])
        self.assertIn("22.4% off its 52-week high on rising volume", row["judgment"]["en"])
        self.assertIn("sell-off is real", row["judgment"]["en"])


if __name__ == "__main__":
    sys.exit(unittest.main(verbosity=2))
