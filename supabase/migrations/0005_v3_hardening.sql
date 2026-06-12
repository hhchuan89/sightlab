-- 0005_v3_hardening.sql — post-pivot hardening (PLAN §15).
--
-- v3 is the OPEN/FREE model: content is public, Stripe billing is PARKED.
-- This migration (1) un-grants the parked self-service billing RPCs so a
-- logged-in user cannot reach them, (2) drops a redundant index, and
-- (3) adds the column that dedupes the daily email digest.

-- ---------------------------------------------------------------------------
-- (1) Park the self-service billing RPCs for real.
--
-- 0003_billing.sql granted set_stripe_customer_id + sync_self_subscription to
-- `authenticated`. With those grants live, any logged-in user can chain the two
-- via PostgREST: set_stripe_customer_id() writes an arbitrary caller-supplied
-- string into their own profiles.stripe_customer_id (no Stripe verification),
-- and sync_self_subscription() then "verifies" ownership against that same
-- self-set value — a self-referential check that always passes — before
-- inserting a subscription with a caller-supplied status ('active') and
-- reconciling role to 'paid'. Two RPC calls, zero Stripe interaction, role
-- escalated. role gates no content in v3, but the moment a paid tier returns
-- this is a free full bypass — so the grants go now.
--
-- The FUNCTIONS stay in the DB (parked, per PLAN §15): when the paid tier is
-- revived, re-grant only after the ownership check is fixed to verify against
-- Stripe server-side rather than a caller-writable column. 0003 already
-- revoked public/anon; `authenticated` is the only grantee left to revoke.
revoke execute on function public.set_stripe_customer_id(text) from authenticated;
revoke execute on function public.sync_self_subscription(text, text, text, text, text, timestamptz, boolean) from authenticated;

comment on function public.set_stripe_customer_id(text) is
  'PARKED (PLAN §15) — execute revoked from authenticated in 0005. Do not re-grant until customer-id ownership is verified against Stripe server-side.';
comment on function public.sync_self_subscription(text, text, text, text, text, timestamptz, boolean) is
  'PARKED (PLAN §15) — execute revoked from authenticated in 0005. Its ownership check trusts a caller-writable column; fix before any re-grant.';

-- ---------------------------------------------------------------------------
-- (2) Drop the redundant index on profiles.stripe_customer_id.
--
-- 0001_init.sql declares the column UNIQUE (which already creates a unique
-- B-tree index, profiles_stripe_customer_id_key) and then ALSO creates this
-- explicit non-unique index on the identical column. Every equality lookup is
-- fully served by the unique index, so the duplicate is pure write
-- amplification + storage with zero read benefit.
drop index if exists public.profiles_stripe_customer_id_idx;

-- ---------------------------------------------------------------------------
-- (3) Dedupe the daily email digest.
--
-- /api/ingest documents same-date re-POST as a supported recovery flow
-- (Delayed-banner clear, EN backfill), but it used to fire sendDigest() on
-- EVERY successful upsert — every re-run re-emailed the full opt-in list, and
-- a replayed signed request did the same. The ingest route now sends the
-- digest only when this column is NULL and stamps it after a successful send,
-- so each dispatch_date emails at most once.
alter table public.dispatches add column if not exists digest_sent_at timestamptz;

comment on column public.dispatches.digest_sent_at is
  'When the daily email digest for this dispatch was sent (null = not yet). Ingest sends only when null, then stamps — dedupes re-POSTs/replays so each date emails the opt-in list at most once.';
