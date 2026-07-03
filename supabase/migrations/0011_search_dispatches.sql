-- 0011_search_dispatches.sql — archive text search for the MCP layer
-- (agent-access Phase 2a, PLAN §15.10).
--
-- v1 is deliberately simple: ILIKE across the intros and the JSONB text of the
-- content blocks, returning METADATA ONLY (date + intros) — the agent follows
-- up with get_dispatch_public for full content. At the archive's scale (one
-- row per trading day) a sequential ILIKE is fine for years; revisit with
-- tsvector if the archive ever grows past a few thousand rows. The query is a
-- bound parameter (no concatenated SQL); '%'/'_' inside it merely widen the
-- match, which is harmless. Length is clamped so a degenerate pattern cannot
-- be weaponised, and the row cap is enforced in SQL.
create or replace function public.search_dispatches_public(p_query text, p_limit int default 10)
  returns table(dispatch_date date, intro_en text, intro_zh text)
  language sql security definer stable set search_path = public as $$
  select d.dispatch_date, d.intro_en, d.intro_zh
  from public.dispatches d
  where d.published
    and length(trim(coalesce(p_query, ''))) between 2 and 100
    and (
      d.intro_en ilike '%' || trim(p_query) || '%'
      or d.intro_zh ilike '%' || trim(p_query) || '%'
      or d.flows_section6::text ilike '%' || trim(p_query) || '%'
      or d.cycle_section7::text ilike '%' || trim(p_query) || '%'
      or d.deepread_section::text ilike '%' || trim(p_query) || '%'
    )
  order by d.dispatch_date desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

revoke all on function public.search_dispatches_public(text, int) from public;
grant execute on function public.search_dispatches_public(text, int) to anon, authenticated;
