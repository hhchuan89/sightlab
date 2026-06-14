-- 0006_kind.sql — daily vs weekly dispatch kind (schedule: Mon rest / Tue–Sat
-- daily / Sun weekly, all at 00:05 UTC).
--
-- Adds a `kind` column to `dispatches` and threads it through the PUBLIC read
-- projection so the site/email/Telegram can frame a Sunday "weekly review"
-- differently from a daily close report. Backfills existing rows to 'daily'.
--
-- The get_*_public RPCs all call project_dispatch_full(), so re-defining that one
-- function propagates `kind` to every public read path — no grant changes needed.

-- New column: NOT NULL with a 'daily' default so every existing row backfills,
-- and a CHECK constraint pins the two-value enum (mirrors the zod + TS contract).
alter table public.dispatches
  add column if not exists kind text not null default 'daily'
    check (kind in ('daily', 'weekly'));

-- Re-define the public projection to carry `kind`. Body is IDENTICAL to
-- 0004_public_v3.sql's project_dispatch_full() with one added key — every
-- existing key is preserved.
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
    'is_locked', false);
$$;
