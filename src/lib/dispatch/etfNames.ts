import type { Locale } from "@/lib/i18n/request";

/**
 * EN display names for the FIXED §6 ETF set the producer emits.
 *
 * The set is pinned upstream: `query_weekly_flows.py` FLOW_ETFS (SPY, QQQ, XLE,
 * XLK, SMH, XLF, XLV, XLP, XLI, IBIT, FBTC) mapped through the dispersion
 * sector map in `scripts/mac/assemble_dispatch.py`. The ingest contract only
 * carries `name_zh` (the harness writes ZH-first prose), so the EN locale needs
 * its own names. Unknown symbols fall back to the bare ticker.
 */
export const ETF_NAME_EN: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  XLK: "Technology",
  XLE: "Energy",
  XLF: "Financials",
  XLV: "Health Care",
  XLP: "Consumer Staples",
  XLI: "Industrials",
  SMH: "Semiconductors (tech sub-sector)",
  IBIT: "Bitcoin (iShares)",
  FBTC: "Bitcoin (Fidelity)",
};

/** Locale-aware ETF display name: EN map (fallback: bare symbol) / harness `name_zh`. */
export function etfDisplayName(etf: string, nameZh: string, locale: Locale): string {
  return locale === "en" ? (ETF_NAME_EN[etf] ?? etf) : nameZh;
}
