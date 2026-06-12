# Paywall / RLS tests

Committed enforcement of the SightLab paywall (PLAN §14-S2, §14-B2, §14-B4).
These are not optional manual checks — CI runs them and the build fails on
regression.

## Run

```bash
# Grep guard only — no network, runs everywhere (CI-cheap):
npm run test:paywall

# Full suite against a live Supabase project:
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
npm run test:paywall
```

## What is asserted

| ID      | Needs live DB | Assertion |
|---------|:-------------:|-----------|
| B2/S2c  | no            | `.from('dispatches')` appears NOWHERE in `src/` — RPCs are the sole read path |
| S2a     | yes           | anon `from('dispatches').select('*')` → 0 rows (RLS deny-all) |
| S2b/B4  | yes           | non-paid `get_latest_dispatch()` response OMITS `flows_section6` / `cycle_section7` |

The live tests SKIP (do not fail) when the env vars are absent, so the grep
guard protects every run regardless of infra. S2b/B4 additionally needs at
least one published dispatch row seeded via SQL; it skips with a note if none
exists.
