-- 0004_public_v3.sql — v3 OPEN / FREE pivot (PLAN §15.1, §15.2).
--
-- SightLab is now a free, open-source research lab. Dispatch CONTENT is fully
-- PUBLIC: anon AND authenticated callers receive the COMPLETE §6/§7 projection
-- (all paid columns + full history). The old role-gated read RPCs from 0002 are
-- KEPT but PARKED — reserved for a possible future paid tier (PLAN §15). They
-- are no longer the active read path; the app calls the PUBLIC RPCs below.
--
-- RLS on `dispatches` stays deny-all (RPC-only): no base-table SELECT policy,
-- so a stolen anon key + select('*') still returns zero rows. The PUBLIC RPCs
-- are SECURITY DEFINER, read past RLS, and project the full row to everyone.

-- profiles gains the email-digest opt-in flag (PLAN §15.2). The `role` column
-- stays but is PARKED (no longer gates content).
alter table public.profiles
  add column if not exists email_opt_in boolean not null default false;

-- Let a signed-in user toggle their OWN email_opt_in (PLAN §15.2). profiles had
-- no UPDATE policy (role was webhook-only). We add a self-update policy AND a
-- COLUMN-LEVEL grant restricted to email_opt_in only — so a user can flip the
-- digest preference but can NEVER escalate their own `role` (still webhook-only
-- via the service role, which bypasses RLS). The column grant is the real wall;
-- the policy just opens the row.
create policy profiles_update_own_optin on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated;
grant update (email_opt_in) on public.profiles to authenticated;

-- ─────────────────────── PARKED — future paid tier (PLAN §15) ───────────────
-- The following role-gated functions from 0002 are intentionally left in place
-- but are NO LONGER WIRED into the app. They are reserved for a possible future
-- paid tier. Document that on the live objects so a future reader knows.
comment on function public.current_role_is_paid() is
  'PARKED — reserved for a future paid tier (PLAN §15). Not used by the public read path.';
comment on function public.project_dispatch(public.dispatches, boolean) is
  'PARKED — reserved for a future paid tier (PLAN §15). Not used by the public read path.';
comment on function public.get_latest_dispatch() is
  'PARKED — reserved for a future paid tier (PLAN §15). Superseded by get_latest_public().';
comment on function public.get_dispatch_by_slug(text) is
  'PARKED — reserved for a future paid tier (PLAN §15). Superseded by get_dispatch_public(text).';
comment on function public.list_dispatches(int, int) is
  'PARKED — reserved for a future paid tier (PLAN §15). Superseded by list_dispatches_public(int,int).';

-- ─────────────────────── ACTIVE — public read path (v3) ─────────────────────
-- project_dispatch_full(): full column projection for EVERYONE. No role check,
-- no is_locked branch — content is public. IMMUTABLE + pure (no security ctx).
create function public.project_dispatch_full(d public.dispatches)
  returns jsonb
  language sql immutable as $$
  select jsonb_build_object(
    'dispatch_date', d.dispatch_date, 'generated_at', d.generated_at,
    'intro_en', d.intro_en, 'intro_zh', d.intro_zh,
    'at_a_glance_en', d.at_a_glance_en, 'at_a_glance_zh', d.at_a_glance_zh,
    'cycle_badge', d.cycle_badge,
    'flows_section6', d.flows_section6, 'cycle_section7', d.cycle_section7,
    'is_locked', false);
$$;

-- get_latest_public(): the latest published dispatch, FULL content, to anyone.
create function public.get_latest_public() returns jsonb
  language sql security definer stable set search_path = public as $$
  select public.project_dispatch_full(d)
  from public.dispatches d where d.published order by d.dispatch_date desc limit 1;
$$;

-- get_dispatch_public(p_slug): one dispatch by date-slug, FULL content, to
-- anyone, for ANY published date (history is public too — no B1 gate).
create function public.get_dispatch_public(p_slug text) returns jsonb
  language sql security definer stable set search_path = public as $$
  select public.project_dispatch_full(d)
  from public.dispatches d
  where d.published and d.dispatch_date = p_slug::date
  limit 1;
$$;

-- list_dispatches_public(): full PUBLIC history list (metadata only — the list
-- view does not need the heavy jsonb; the detail page fetches it). Open to anon.
create function public.list_dispatches_public(p_limit int default 60, p_offset int default 0)
  returns table(dispatch_date date, intro_en text, intro_zh text)
  language sql security definer stable set search_path = public as $$
  select d.dispatch_date, d.intro_en, d.intro_zh
  from public.dispatches d
  where d.published
  order by d.dispatch_date desc limit p_limit offset p_offset;
$$;

-- Grants: all three public read paths are reachable by anon AND authenticated.
revoke all on function public.get_latest_public()                from public;
revoke all on function public.get_dispatch_public(text)          from public;
revoke all on function public.list_dispatches_public(int, int)   from public;
grant execute on function public.get_latest_public()              to anon, authenticated;
grant execute on function public.get_dispatch_public(text)        to anon, authenticated;
grant execute on function public.list_dispatches_public(int, int) to anon, authenticated;
