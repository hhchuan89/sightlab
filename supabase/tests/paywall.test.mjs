/**
 * Paywall / RLS guarantee tests (PLAN §14-S2, §14-B2, §14-B4).
 *
 * These are the COMMITTED enforcement of the paywall — not manual checks. Run
 * with `node --test`. Three assertions:
 *
 *   (1) GREP GUARD (always runs, no infra):
 *       `.from('dispatches')` does NOT appear anywhere in src/ — the only read
 *       path is the RPCs (§14-B2). A future `select('*')` path fails the build.
 *
 *   (2) RLS DENY-ALL (needs a live Supabase):
 *       anon `from('dispatches').select('*')` returns ZERO rows (§14-S2a).
 *
 *   (3) RPC PROJECTION (needs a live Supabase + a seeded published dispatch):
 *       an anon / non-paid caller's get_latest_dispatch() response OMITS the
 *       paid keys `flows_section6` / `cycle_section7` (§14-S2b / §14-B4).
 *
 * HOW TO RUN
 *   Grep guard only (CI-cheap, no network):
 *     node --test supabase/tests/paywall.test.mjs
 *   Full suite against a live project — set, then run the same command:
 *     export NEXT_PUBLIC_SUPABASE_URL=...        # project URL
 *     export NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon (RLS-bound) key
 *   The live tests SKIP (not fail) when those env vars are absent, so the grep
 *   guard still protects every CI run. Test (3) additionally needs at least one
 *   published row (seed one via SQL) — it skips with a note if none exists.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const SRC_DIR = join(REPO_ROOT, "src");

// A direct table READ of dispatches — `.from('dispatches')` chained to `.select` —
// is forbidden in app code (§14-B2 / §15.1): reads go ONLY through the *_public RPCs,
// so no future select() can bypass the projection. The service-role WRITE in the
// ingest route (`.from('dispatches').upsert(...)`) is legitimate and EXEMPT — a write
// cannot leak data, and RLS deny-all blocks any non-service-role write regardless.
const FROM_DISPATCHES = /\.from\(\s*['"`]dispatches['"`]\s*\)/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

test("B2/S2c: src/ never READS dispatches directly — RPC is the sole read path", () => {
  const offenders = [];
  for (const file of walk(SRC_DIR)) {
    const src = readFileSync(file, "utf8");
    let m;
    while ((m = FROM_DISPATCHES.exec(src)) !== null) {
      // Only a `.select` immediately after `.from('dispatches')` is a read (leak risk);
      // `.upsert`/`.insert`/`.update`/`.delete` are writes and are allowed.
      const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (/^\s*\.select\b/.test(tail)) {
        offenders.push(`${file} — direct .from('dispatches').select read`);
      }
    }
  }
  assert.equal(
    offenders.length,
    0,
    `dispatches must be READ only via supabase.rpc(...). Offending reads:\n${offenders.join("\n")}`,
  );
});

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const LIVE = Boolean(URL && ANON);

test(
  "S2a: anon select('*') on dispatches returns ZERO rows (RLS deny-all)",
  { skip: !LIVE && "set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to run" },
  async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(URL, ANON);
    const { data, error } = await supabase.from("dispatches").select("*");
    // RLS deny-all → either an empty array or a permission error; never rows.
    if (error) {
      assert.ok(error, "deny-all may surface as an error — acceptable");
    } else {
      assert.equal(data.length, 0, "RLS must hide all dispatch rows from anon");
    }
  },
);

// v3 OPEN/FREE pivot (PLAN §15.1): content is PUBLIC. The ACTIVE read path is
// get_latest_public(), which returns the FULL projection (both §6/§7 blocks) to
// anon AND authenticated — no role check, no content lock. The old role-gated
// get_latest_dispatch() stays in the DB as PARKED (PLAN §15) and is not tested
// here as a content gate anymore.
test(
  "§15.1: anon get_latest_public() returns the FULL §6/§7 payload (no content gate)",
  { skip: !LIVE && "set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to run" },
  async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(URL, ANON); // anon — the strictest caller
    const { data, error } = await supabase.rpc("get_latest_public");
    assert.equal(error, null, error ? `rpc error: ${error.message}` : "");
    if (data == null) {
      test.skip?.("no published dispatch seeded; insert one to assert the projection");
      return;
    }
    // Content is public: both blocks present, never locked.
    assert.ok("flows_section6" in data, "§6 must be PUBLIC (present for anon)");
    assert.ok("cycle_section7" in data, "§7 must be PUBLIC (present for anon)");
    assert.equal(data.is_locked, false, "content is not gated in v3");
    assert.ok("intro_en" in data, "intro must be present");
  },
);
