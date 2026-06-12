-- 0001_init.sql — tables, indexes, the handle_new_user trigger, and RLS.
--
-- Design law (PLAN §3, §14):
--   * deny-by-default RLS everywhere; `dispatches` has NO select policy at all —
--     it is read ONLY through the SECURITY DEFINER RPCs in 0002_rpcs.sql (§14-B2).
--   * `published boolean` + `dispatch_date` ARE the slug — there is NO status enum
--     and NO separate slug column (§14-S3).
--   * `handle_new_user` stores `email` on `profiles` so it is the canonical display
--     email; we never half-join auth.users for it (§14-C9).

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. `role` is webhook-controlled (never set by
-- the client); reconcile_role() in 0003_billing.sql is the only writer of it
-- besides the default. RLS lets a user read ONLY their own row.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  role                text not null default 'free' check (role in ('free','paid')),
  stripe_customer_id  text unique,
  locale              text default 'en' check (locale in ('en','zh')),
  created_at          timestamptz not null default now()
);
create index profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);

-- Auto-create a profile row on signup, carrying the email forward (§14-C9).
-- SECURITY DEFINER + pinned search_path so it runs as table owner from the
-- auth schema trigger without being hijacked by a mutable search_path.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- dispatches: free teaser columns (bilingual prose + a free-safe scalar badge)
-- alongside the PAID jsonb columns. `dispatch_date` is unique → it is the slug
-- and the upsert key for ingest. NO select policy is created for this table:
-- the RPCs in 0002 are the sole read path (§14-B2).
-- ---------------------------------------------------------------------------
create table public.dispatches (
  id              uuid primary key default gen_random_uuid(),
  dispatch_date   date not null unique,                 -- the slug; one per UTC day
  generated_at    timestamptz not null,
  published       boolean not null default true,
  -- FREE columns (served to anyone) — bilingual prose:
  intro_en        text, intro_zh        text,
  at_a_glance_en  text, at_a_glance_zh  text,
  -- free-safe scalar badge (stage + confidence, NO scores/tables) (§14-B3):
  cycle_badge     jsonb,                                 -- { stage_num, templeton_stage, confidence }
  -- PAID columns (NEVER served to non-paid):
  flows_section6  jsonb,                                 -- §6 weekly fund-flows: rows + numbers + table2 prose
  cycle_section7  jsonb,                                 -- §7 cycle: sectors, dispersion, composite, overlays + prose
  teaser_en       text, teaser_zh       text,            -- X/Telegram partial teaser
  created_at      timestamptz not null default now()
);
comment on column public.dispatches.flows_section6 is 'PAID — §6 weekly fund-flows; never projected to non-paid callers.';
comment on column public.dispatches.cycle_section7 is 'PAID — §7 cycle positioning; never projected to non-paid callers.';

-- Partial index covering the only hot query: latest / list of published rows.
create index dispatches_published_date_idx
  on public.dispatches (dispatch_date desc) where published;

-- ---------------------------------------------------------------------------
-- subscriptions: PK = stripe subscription id; written ONLY by the webhook
-- (service role bypasses RLS). A user may read their own rows, but role in the
-- app is NEVER derived from here — it is read from profiles.role (§14-C3).
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  stripe_subscription_id text primary key,
  user_id                uuid not null references auth.users(id) on delete cascade,
  status                 text not null,                  -- active|trialing|past_due|canceled|...
  price_id               text,
  interval               text,                           -- month|year
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false,
  updated_at             timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_status_idx  on public.subscriptions (status);

-- ---------------------------------------------------------------------------
-- stripe_events: idempotency ledger (service-role only, no client read path).
-- ---------------------------------------------------------------------------
create table public.stripe_events (
  id           text primary key,                         -- Stripe event id
  type         text,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- v2 seams — insert-only / service-role; no client read path.
-- waitlist gets unique(email) so a re-submit is a no-op, not a duplicate (§14-S4).
-- ---------------------------------------------------------------------------
create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,                       -- §14-S4: one row per email
  created_at timestamptz not null default now()
);
create table public.telegram_members (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  telegram_username text,
  approved          boolean default false,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default everywhere. Enabling RLS with no permissive policy
-- means anon/authenticated get ZERO rows; the service role bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.dispatches       enable row level security;  -- NO select policy → RPC-only (§14-B2)
alter table public.subscriptions    enable row level security;
alter table public.stripe_events    enable row level security;  -- service-role only
alter table public.waitlist         enable row level security;
alter table public.telegram_members enable row level security;

-- profiles / subscriptions: a signed-in user may read only their own row.
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = user_id);

-- waitlist: insert allowed (anyone), SELECT never (deny-by-default stands).
create policy waitlist_insert_anon on public.waitlist
  for insert with check (true);

-- NOTE: profiles/subscriptions intentionally have NO insert/update/delete
-- policy — role is webhook-only and the service role bypasses RLS. dispatches,
-- stripe_events, telegram_members have NO policy at all (fully locked to
-- clients; only the service role and SECURITY DEFINER RPCs touch them).
