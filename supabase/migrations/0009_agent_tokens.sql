-- 0009_agent_tokens.sql — MCP personal tokens + daily rate limit (agent-access
-- Phase 1, PLAN §15.10, decision 2026-07-03).
--
-- Design: the MCP layer is READ-ONLY BY CONSTRUCTION and never holds the
-- service-role key. Token verification and the daily counter therefore run as
-- two narrow SECURITY DEFINER functions, executable by anon — the ONLY writes
-- reachable from the MCP layer are "increment my own counter". Tokens are
-- stored as SHA-256 hashes (the plaintext is shown once at mint time); owners
-- manage their tokens through RLS (cookie-bound client), so no admin path is
-- involved anywhere in the token lifecycle.

create table public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  last4 text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  day_date date,
  day_count integer not null default 0
);

alter table public.agent_tokens enable row level security;

-- Owners see and manage ONLY their own tokens. Revoke = set revoked_at
-- (no delete policy — the row is the audit trail).
create policy agent_tokens_select_own on public.agent_tokens
  for select using (auth.uid() = user_id);
create policy agent_tokens_insert_own on public.agent_tokens
  for insert with check (auth.uid() = user_id);
create policy agent_tokens_update_own on public.agent_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cheap validity check (per HTTP request, NOT counted against the quota —
-- protocol overhead like initialize/tools-list must not eat the 30 calls).
create or replace function public.mcp_verify_token(p_token_hash text)
  returns jsonb
  language sql security definer stable set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'user_id', t.user_id::text)
       from public.agent_tokens t
      where t.token_hash = p_token_hash and t.revoked_at is null
      limit 1),
    jsonb_build_object('ok', false));
$$;

-- Authenticate + count ONE tool call, atomically (row lock prevents races).
-- UTC day window; limit is passed by the caller (env-driven, default 30) and
-- clamped to a sane range so a misconfigured env cannot disable the limiter.
create or replace function public.mcp_use_token(p_token_hash text, p_daily_limit int default 30)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_limit int := least(greatest(coalesce(p_daily_limit, 30), 1), 1000);
  v_today date := (now() at time zone 'utc')::date;
  v_row public.agent_tokens;
begin
  select * into v_row from public.agent_tokens
   where token_hash = p_token_hash and revoked_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;
  if v_row.day_date is distinct from v_today then
    update public.agent_tokens set day_date = v_today, day_count = 1 where id = v_row.id;
    return jsonb_build_object('ok', true, 'remaining', v_limit - 1);
  end if;
  if v_row.day_count >= v_limit then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited',
                              'resets_utc', (v_today + 1)::text);
  end if;
  update public.agent_tokens set day_count = v_row.day_count + 1 where id = v_row.id;
  return jsonb_build_object('ok', true, 'remaining', v_limit - 1 - v_row.day_count);
end;
$$;

revoke all on function public.mcp_verify_token(text) from public;
revoke all on function public.mcp_use_token(text, int) from public;
grant execute on function public.mcp_verify_token(text) to anon, authenticated;
grant execute on function public.mcp_use_token(text, int) to anon, authenticated;
