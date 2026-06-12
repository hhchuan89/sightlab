-- 0003_billing.sql — role derivation (PLAN §3.3, §8.3, §14-C3).
--
-- Role is NEVER set from a single Stripe event. After every webhook mutation
-- the handler calls reconcile_role(uid), which recomputes role by SCANNING the
-- current subscriptions. This makes out-of-order webhooks safe (an old event
-- cannot strand a user) and treats `past_due` as NOT paid — access lapses
-- naturally and `invoice.paid` restores it.

create function public.reconcile_role(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare is_paid boolean;
begin
  select exists(
    select 1 from public.subscriptions
    where user_id = p_user and status in ('active','trialing')
  ) into is_paid;

  update public.profiles
     set role = case when is_paid then 'paid' else 'free' end
   where id = p_user;
end; $$;

-- Only the service role (webhook) should ever invoke this. Revoke from clients.
revoke all on function public.reconcile_role(uuid) from public;
revoke all on function public.reconcile_role(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_stripe_customer_id — the ONLY way app (user-client) code may write a
-- Stripe customer id onto a profile (PLAN §14-C5: write the id back BEFORE
-- Checkout so there is exactly ONE Customer per user, reused thereafter).
--
-- profiles has NO RLS update policy (role + billing fields are webhook-owned),
-- so a normal user UPDATE is impossible by design. This SECURITY DEFINER fn is
-- the narrow, safe exception: it writes ONLY the caller's own row (auth.uid())
-- and ONLY when stripe_customer_id is currently NULL — a caller can never
-- overwrite or hijack an already-linked Customer. It does NOT touch `role`
-- (still derived solely by reconcile_role from the webhook). Idempotent: a
-- second call with a row already linked is a silent no-op (0 rows updated, no
-- error), which is exactly what the reuse path wants.
create function public.set_stripe_customer_id(p_customer_id text)
  returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'set_stripe_customer_id: no authenticated user';
  end if;
  update public.profiles
     set stripe_customer_id = p_customer_id
   where id = auth.uid()
     and stripe_customer_id is null;
end; $$;

revoke all on function public.set_stripe_customer_id(text) from public;
revoke all on function public.set_stripe_customer_id(text) from anon;
grant execute on function public.set_stripe_customer_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_self_subscription — the /account reconcile FALLBACK (PLAN §14-C4).
--
-- The webhook is the normal path that writes `subscriptions` + reconciles role
-- via the service-role admin client. But a dropped/missed webhook can strand a
-- PAYING customer at role='free'. On /account load, if the profile has a
-- stripe_customer_id but role='free', the page re-queries Stripe server-side
-- (read-only, via the secret key) for the customer's active subscription and
-- hands the facts to THIS function — without importing the service-role admin
-- client into a page (that import is reserved for ingest + webhook, §3.2).
--
-- Safety: SECURITY DEFINER but it ONLY ever writes the CALLER's own row
-- (user_id := auth.uid()) and ONLY for a subscription whose customer matches the
-- caller's own stripe_customer_id on profiles. A user therefore cannot fabricate
-- a paid subscription for themselves or anyone else: the status/period it writes
-- are exactly what the server read back from Stripe, and the customer-ownership
-- check ties the row to their real Customer. Role is still DERIVED by the
-- reconcile call at the end, never set directly.
create function public.sync_self_subscription(
  p_stripe_subscription_id text,
  p_stripe_customer_id     text,
  p_status                 text,
  p_price_id               text,
  p_interval               text,
  p_current_period_end     timestamptz,
  p_cancel_at_period_end   boolean
) returns void
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sync_self_subscription: no authenticated user';
  end if;
  -- The caller may only sync a subscription belonging to THEIR OWN customer.
  if not exists (
    select 1 from public.profiles
    where id = v_uid and stripe_customer_id = p_stripe_customer_id
  ) then
    raise exception 'sync_self_subscription: customer does not belong to caller';
  end if;

  insert into public.subscriptions as s (
    stripe_subscription_id, user_id, status, price_id, interval,
    current_period_end, cancel_at_period_end, updated_at
  ) values (
    p_stripe_subscription_id, v_uid, p_status, p_price_id, p_interval,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), now()
  )
  on conflict (stripe_subscription_id) do update set
    status               = excluded.status,
    price_id             = excluded.price_id,
    interval             = excluded.interval,
    current_period_end   = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at           = now()
  where s.user_id = v_uid;  -- never let one user clobber another's row

  perform public.reconcile_role(v_uid);
end; $$;

revoke all on function public.sync_self_subscription(text,text,text,text,text,timestamptz,boolean) from public;
revoke all on function public.sync_self_subscription(text,text,text,text,text,timestamptz,boolean) from anon;
grant execute on function public.sync_self_subscription(text,text,text,text,text,timestamptz,boolean) to authenticated;
