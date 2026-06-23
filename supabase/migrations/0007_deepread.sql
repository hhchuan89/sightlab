-- 0007_deepread.sql — §15.9 market-structure deep-read section.
--
-- Adds a `deepread_section` jsonb column to `dispatches` and threads it through the
-- PUBLIC read projection. The column holds { teaser:{zh,en}, body:{zh,en} } — pure
-- market commentary, NO holdings (the producer's assert_no_holdings + the ingest zod
-- key-guard both still scan it). null on rows whose producer predates §15.9.
--
-- The RPC returns the FULL deepread (teaser + body) to all callers; the LOGIN GATE
-- is applied at render (DispatchArticle withholds `body` for anon — it is never
-- serialized to a logged-out client). The body is not privacy-sensitive (market-only),
-- so render-level withholding is sufficient; the gate is a distribution choice (§15.9),
-- not a privacy boundary (§15.4 holdings invariant is enforced separately + upstream).

-- Nullable, no default → existing rows read as NULL, new rows fill it. Additive,
-- mirrors the optional zod field — no version cutover.
alter table public.dispatches
  add column if not exists deepread_section jsonb;

-- Re-define the public projection to carry `deepread_section`. Body is IDENTICAL to
-- 0006_kind.sql's project_dispatch_full() with one added key — every existing key is
-- preserved, so all get_*_public RPCs propagate it with no grant changes.
create or replace function public.project_dispatch_full(d public.dispatches)
  returns jsonb
  language sql immutable as $$
  select jsonb_build_object(
    'dispatch_date', d.dispatch_date, 'generated_at', d.generated_at,
    'kind', d.kind,
    'intro_en', d.intro_en, 'intro_zh', d.intro_zh,
    'at_a_glance_en', d.at_a_glance_en, 'at_a_glance_zh', d.at_a_glance_zh,
    'cycle_badge', d.cycle_badge,
    'flows_section6', d.flows_section6, 'cycle_section7', d.cycle_section7,
    'deepread_section', d.deepread_section,
    'is_locked', false);
$$;
