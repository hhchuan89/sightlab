-- 0010_agent_tokens_grants.sql — column-scope the writable surface of
-- agent_tokens (security-review finding on 0009, 2026-07-03).
--
-- The default table-wide grants let an AUTHENTICATED token owner defeat the
-- rate limiter through PostgREST with their own session: UPDATE day_count=0 /
-- day_date=null (counter reset on demand), or INSERT a row with a huge
-- negative day_count (a day of effectively unlimited quota). RLS row-scoping
-- alone cannot stop either — the rows ARE the attacker's own. Column-scoped
-- grants are the wall (same pattern 0004 uses for profiles.email_opt_in):
-- owners may INSERT only the identity columns (counters take their defaults)
-- and UPDATE only revoked_at (the revoke action); every day_count/day_date
-- mutation is forced through the SECURITY DEFINER mcp_use_token.
revoke insert, update, delete on public.agent_tokens from authenticated;
revoke all on public.agent_tokens from anon;
grant insert (user_id, token_hash, last4) on public.agent_tokens to authenticated;
grant update (revoked_at) on public.agent_tokens to authenticated;
