/**
 * 🔒 PRIVACY GUARD (PLAN §15.4, LOCKED — supersedes any earlier contract).
 *
 * The dispatch — site, email, Telegram, X — carries ONLY market-wide §6 (fund
 * flows) + §7 (cycle / dispersion / Weinstein stage + MARKET-STRUCTURE sector
 * judgment). It NEVER carries holdings:
 *   • no `holding_note` / 「对持仓的话」 (the §7 "talk-to-your-position" field)
 *   • no portfolio-action / `portfolio_action`
 *   • no user-ticker `bucket` fields
 *   • no §8 portfolio block (`section8` / `portfolio`)
 *
 * This module is the single runtime enforcement point. It deep-scans an object's
 * KEY NAMES for any banned holdings token and throws if one appears. The email
 * template calls `assertNoHoldings()` before rendering, so a holdings field can
 * never reach an inbox — and the unit test asserts the same over the email
 * payload + the ingest zod schema shape.
 *
 * No `server-only` import: this runs in the build, in tests, and on the server.
 */

/**
 * Banned KEY-NAME pattern — ALIGNED with the ingest guard in
 * src/lib/ingest/schema.ts: ANY key matching /holding|portfolio|持仓/i is a
 * holdings key. The bare 持仓 substring (not just 对持仓) is load-bearing: a key
 * like `持仓明细` must be caught too. The market-safe §7 field is `judgment`
 * (market-structure commentary) — that is explicitly allowed.
 */
const HOLDINGS_KEY_RE = /holding|portfolio|持仓/i;

/**
 * Extra banned tokens beyond the shared regex (substring, case-insensitive):
 * the §8 portfolio block and the per-user ticker/position fields. The ingest
 * schema's top-level `.strict()` already rejects a stray `section8`, but this
 * guard also runs on the EMAIL payload, so it bans them independently.
 */
const EXTRA_BANNED_TOKENS = [
  "position_action",
  "user_ticker",
  "userticker",
  "section8",
  "section_8",
] as const;

function isBannedKey(key: string): boolean {
  if (HOLDINGS_KEY_RE.test(key)) return true;
  const k = key.toLowerCase();
  return EXTRA_BANNED_TOKENS.some((tok) => k.includes(tok));
}

/**
 * Return the list of banned holdings keys found anywhere in `value` (deep). The
 * path is dotted (e.g. `cycle_section7.holding_note`) for a useful error.
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
      if (isBannedKey(key)) hits.push(childPath);
      hits.push(...findHoldingsKeys(child, childPath));
    }
  }

  return hits;
}

/**
 * THROW if the dispatch payload contains any holdings field (PLAN §15.4). Called
 * before the email is rendered — fail loud, never email holdings.
 */
export function assertNoHoldings(dispatch: unknown): void {
  const hits = findHoldingsKeys(dispatch);
  if (hits.length > 0) {
    throw new Error(
      `PRIVACY VIOLATION (PLAN §15.4 LOCKED): dispatch payload contains holdings fields: ${hits.join(", ")}. ` +
        "The dispatch must carry ONLY market-wide §6/§7 — no holdings/portfolio data.",
    );
  }
}
