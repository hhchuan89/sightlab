import type { Bilingual } from "@/lib/dispatch/types";

/**
 * Model-limitation caveat (PLAN §5.1, §11 appendix).
 *
 * HARDCODED constant, identical every day — NOT stored per dispatch. It states
 * the framing the whole product rests on: the cycle read is a CONFIRMER of the
 * regime already in place, not a predictor of the next one; the dead-zone /
 * top-blindness limits are owned up front, not buried.
 */
export const CAVEAT: Bilingual = {
  en:
    "SightLab is research, not investment advice. The cycle read is a confirmer " +
    "of the regime already in place — it tells you where the tape stands today, " +
    "not where it turns next. It is strongest mid-trend and deliberately blind to " +
    "exact tops and bottoms: do not read a high-confidence Stage 2 as a green " +
    "light to chase, nor a Stage 4 as a guarantee of further downside. Numbers are " +
    "computed deterministically; the prose interprets them and can be wrong. Size " +
    "your own risk.",
  zh:
    "SightLab 是研究，不是投资建议。周期读数是对既有格局的确认器——它告诉你盘面" +
    "今天站在哪里，而不是下一步在哪里转向。它在趋势中段最可靠，且刻意对精确的顶部" +
    "与底部失明：不要把高置信度的第 2 阶段当成追高的绿灯，也不要把第 4 阶段当成继续" +
    "下跌的保证。数字由确定性算法算出；文字是对它们的解读，可能出错。请自行控制仓位" +
    "与风险。",
};
