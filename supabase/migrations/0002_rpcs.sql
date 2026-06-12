-- 0002_rpcs.sql — the ONLY read path for dispatches (PLAN §3.2, §14-B1/B2).
--
-- RLS gates rows, not columns, so "free users see 4 of 6 columns" is impossible
-- with a policy. The leak-proof, duplication-free design is a deny-all table
-- (0001) + SECURITY DEFINER RPCs that BUILD the JSON projection themselves.
-- A non-paid caller receives a JSON object that LITERALLY does not contain
-- `flows_section6` / `cycle_section7` — the lock is real (bytes never
-- serialized), not CSS. `is_locked: true` only tells the UI to render the wall.

-- current_role_is_paid(): the one role check, read from profiles.role for the
-- calling user (auth.uid()). SECURITY DEFINER so it can read profiles past RLS;
-- it only ever exposes a boolean for the caller's OWN row.
create function public.current_role_is_paid() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select role = 'paid' from public.profiles where id = auth.uid()), false);
$$;

-- project_dispatch(): the column projection. For paid callers it includes the
-- paid jsonb columns; for non-paid the paid keys are ABSENT (not null) so they
-- are never serialized. IMMUTABLE + no security context — it is pure.
create function public.project_dispatch(d public.dispatches, paid boolean)
  returns jsonb
  language sql immutable as $$
  select case when paid then
    jsonb_build_object(
      'dispatch_date', d.dispatch_date, 'generated_at', d.generated_at,
      'intro_en', d.intro_en, 'intro_zh', d.intro_zh,
      'at_a_glance_en', d.at_a_glance_en, 'at_a_glance_zh', d.at_a_glance_zh,
      'cycle_badge', d.cycle_badge,
      'flows_section6', d.flows_section6, 'cycle_section7', d.cycle_section7,
      'is_locked', false)
  else
    jsonb_build_object(                                   -- paid keys ABSENT, not null
      'dispatch_date', d.dispatch_date, 'generated_at', d.generated_at,
      'intro_en', d.intro_en, 'intro_zh', d.intro_zh,
      'at_a_glance_en', d.at_a_glance_en, 'at_a_glance_zh', d.at_a_glance_zh,
      'cycle_badge', d.cycle_badge,
      'is_locked', true)
  end;
$$;

-- get_latest_dispatch(): teaser-or-full projection of the latest published day.
create function public.get_latest_dispatch() returns jsonb
  language sql security definer stable set search_path = public as $$
  select public.project_dispatch(d, public.current_role_is_paid())
  from public.dispatches d where d.published order by d.dispatch_date desc limit 1;
$$;

-- get_dispatch_by_slug(): B1-FIXED (PLAN §3.2). Non-paid callers get a teaser
-- ONLY for the LATEST published date. Any PAST date returns a locked stub with
-- NO prose — a free user cannot walk /dispatch/<old-date> URLs and harvest every
-- past intro + at-a-glance. Paid callers get the full projection for any date.
create function public.get_dispatch_by_slug(p_slug text) returns jsonb
  language sql security definer stable set search_path = public as $$
  with latest as (select max(dispatch_date) as d from public.dispatches where published)
  select case
    when public.current_role_is_paid() then public.project_dispatch(d, true)   -- paid: full, any date
    when d.dispatch_date = (select d from latest) then public.project_dispatch(d, false) -- free: teaser, latest only
    else jsonb_build_object('dispatch_date', d.dispatch_date,                    -- free + past date: locked stub
                            'is_locked', true, 'requires_paid_history', true)
  end
  from public.dispatches d
  where d.published and d.dispatch_date = p_slug::date
  limit 1;
$$;

-- list_dispatches(): history list — PAID-ONLY (non-paid get an empty set, UI
-- shows upsell). Returns METADATA columns only; never the paid jsonb.
create function public.list_dispatches(p_limit int default 60, p_offset int default 0)
  returns table(dispatch_date date, intro_en text, intro_zh text)
  language sql security definer stable set search_path = public as $$
  select d.dispatch_date, d.intro_en, d.intro_zh
  from public.dispatches d
  where d.published and public.current_role_is_paid()
  order by d.dispatch_date desc limit p_limit offset p_offset;
$$;

-- Grants: latest + by_slug are reachable by anon AND authenticated (free users
-- must land on the teaser). list is authenticated-only (no anon history path).
revoke all on function public.get_latest_dispatch()       from public;
revoke all on function public.get_dispatch_by_slug(text)  from public;
revoke all on function public.list_dispatches(int,int)    from public;
grant execute on function public.get_latest_dispatch()      to anon, authenticated;
grant execute on function public.get_dispatch_by_slug(text) to anon, authenticated;
grant execute on function public.list_dispatches(int,int)   to authenticated; -- not anon
