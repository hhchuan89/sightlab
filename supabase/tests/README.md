# Public read-path / RLS / privacy tests

Committed enforcement of SightLab's **v3 open/free content model** (PLAN §15.1)
and the **privacy iron rule** (PLAN §15.4). These are not optional manual
checks — CI runs them and the build fails on regression.

> Naming note: the npm script is still `test:paywall` for CI continuity, but
> there is **no paywall** — the v3 pivot (2026-06-06) made all dispatch content
> public. What these tests now lock in is the *opposite* of a paywall: that
> content STAYS fully public to anon, that the raw table stays RLS-hidden
> (RPCs are the sole read path), and that no holdings data can ever ship.

## Run

```bash
# Static guards only — no network, runs everywhere (CI-cheap):
npm run test:paywall

# Full suite against a live Supabase project:
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
npm run test:paywall
```

## What is asserted

| ID         | Needs live DB | Assertion |
|------------|:-------------:|-----------|
| B2/S2c     | no            | `.from('dispatches')` READS appear nowhere in `src/` — RPCs are the sole read path |
| S2a        | yes           | anon `from('dispatches').select('*')` → 0 rows (RLS deny-all on the raw table) |
| §15.1      | yes           | anon `get_latest_public()` returns the **FULL** payload — `flows_section6` AND `cycle_section7` present, `is_locked === false`. Content is public; there is no role gate |
| §15.4      | no            | the ingest schema / payload contract carries ZERO holdings-shaped fields |
| §15.4 live | yes           | the live `get_latest_public()` payload matches no forbidden holdings pattern |

The live tests SKIP (do not fail) when the env vars are absent, so the static
guards protect every run regardless of infra. The live content/privacy checks
additionally need at least one published dispatch row; they skip with a note if
none exists.

The old role-gated `get_latest_dispatch()` RPC remains in the DB as **PARKED**
(reserved for a possible future paid tier, PLAN §15) and is deliberately no
longer asserted as a content gate.
