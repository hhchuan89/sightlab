/**
 * PRIVACY guard tests (PLAN §15.4 — LOCKED).
 *
 * The dispatch — site, email, Telegram, X — carries ONLY market-wide §6 (fund
 * flows) + §7 (cycle / dispersion / Weinstein stage + MARKET-STRUCTURE sector
 * judgment). It must NEVER carry holdings: no `holding_note` / 对持仓的话 /
 * portfolio-action / user-ticker `bucket` fields, and no §8 portfolio block.
 *
 * Two assertions:
 *   (1) STATIC GUARD (always runs, no infra): the dispatch contract surface
 *       (the projected types + the public read queries) contains ZERO
 *       holdings-shaped field names. A future dev re-adding a holdings field to
 *       the payload shape fails the build.
 *   (2) LIVE GUARD (needs a live Supabase + a seeded row): the actual
 *       get_latest_public() payload contains none of the forbidden keys.
 *
 * NOTE: the ingest zod schema (PLAN §5/§15.4) is built in Phase E; once it
 * exists, src/lib/ingest/schema.ts joins the STATIC GUARD file set below so the
 * schema is asserted holdings-free too.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

// Holdings/portfolio field NAMES that would mean a leak in the payload contract.
// We match each name only in a FIELD-DEFINITION position — as a TS interface
// member (`name:` / `name?:`) or a JSON/object key (`"name":` / `'name':`) — so
// prose mentioning the word (e.g. a "NEVER holdings" caveat comment, or privacy
// COPY in messages/*) does NOT false-positive. Only an actual payload field
// fails. The bare `对持仓` token is forbidden anywhere.
const NAMES = [
  "holding_note",
  "holdings",
  "holding",
  "portfolio_action",
  "portfolio_block",
  "user_ticker",
  "section8",
  "cycle_section8",
];
const FORBIDDEN_FIELDS = [
  // field name as a TS member or quoted object key, in definition position.
  new RegExp(`(?:^|[\\s{,])["']?(?:${NAMES.join("|")})["']?\\??\\s*:`, "im"),
  /对持仓/,
];

// Files that DEFINE the dispatch payload contract / read surface. These must be
// holdings-free. (Prose in messages/* like "never your holdings" is privacy
// COPY, not a payload field — intentionally excluded from this guard.)
const CONTRACT_FILES = [
  join(REPO_ROOT, "src", "lib", "dispatch", "types.ts"),
  join(REPO_ROOT, "src", "lib", "dispatch", "queries.ts"),
  // Joins the guard once Phase E adds it:
  join(REPO_ROOT, "src", "lib", "ingest", "schema.ts"),
];

test("§15.4: the dispatch payload contract carries ZERO holdings fields", () => {
  const offenders = [];
  for (const file of CONTRACT_FILES) {
    if (!existsSync(file)) continue; // schema.ts is Phase E — skip until it lands
    const src = readFileSync(file, "utf8");
    for (const pat of FORBIDDEN_FIELDS) {
      if (pat.test(src)) offenders.push(`${file} :: ${pat}`);
    }
  }
  assert.equal(
    offenders.length,
    0,
    `holdings/portfolio fields are forbidden in the dispatch payload (PLAN §15.4):\n${offenders.join("\n")}`,
  );
});

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const LIVE = Boolean(URL && ANON);

test(
  "§15.4 LIVE: get_latest_public() payload contains no holdings keys",
  { skip: !LIVE && "set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to run" },
  async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(URL, ANON);
    const { data, error } = await supabase.rpc("get_latest_public");
    assert.equal(error, null, error ? `rpc error: ${error.message}` : "");
    if (data == null) {
      test.skip?.("no published dispatch seeded; insert one to assert the payload");
      return;
    }
    const serialized = JSON.stringify(data);
    for (const pat of FORBIDDEN_FIELDS) {
      assert.ok(!pat.test(serialized), `forbidden holdings pattern in payload: ${pat}`);
    }
  },
);
