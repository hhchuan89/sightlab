# SightLab — Implementation Plan (v1)

> Build-ready synthesis of recon 01–05. Four product decisions are LOCKED and not re-opened:
> free tier = intro + at-a-glance only; pipeline = reuse the Mac harness; the paper is an
> in-app HTML reader (no PDF); v1 scope = the paid loop first (X / Google login / Telegram
> auto-post are v2, but their seams exist in v1).
>
> **v2 (2026-06-06) — incorporates every `PLAN_REVIEW.md` finding. See §14 (Review fixes,
> LOCKED). Where §14 conflicts with an earlier section's prose, §14 wins.** B1's leaking SQL
> is fixed inline below (§3.2). Mac-as-origin is accepted for v1 with the 4 guardrails (§14-M).

---

## 1. Product summary

SightLab is a subscription daily-dispatch SaaS that productizes two sections of an existing
personal quant harness: **§6 Weekly Fund Flows** (an ETF money-flow table across sectors) and
**§7 Market Cycle Positioning** (a Weinstein-stage + sector-dispersion cycle read). Every day at
UTC 00:00 the Mac harness computes the deterministic numbers, translates the Chinese narrative to
English, and POSTs one bilingual "dispatch" to a Next.js/Vercel app backed by Supabase; the site
renders it in an editorial newspaper aesthetic (orange accent, serif body, light+dark, EN/中文
toggle). Free and anonymous visitors see only today's intro paragraph(s) and an at-a-glance summary
box; the full §6/§7 tables and all history are paid-only, gated **server-side** (the paid bytes are
never serialized to a non-paid client — a `SECURITY DEFINER` RPC projects columns by role; CSS blur
is cosmetic only). Access is a single $15/mo (or $162/yr, 10% off) Stripe subscription. A public
half-open-source "paper" page explains the methodology in a copy/print-protected in-app reader.

---

## 2. Final stack + repo file tree

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth, RLS
+ `SECURITY DEFINER` RPCs) · Stripe (Checkout + Customer Portal + webhooks) · `next-intl`
(cookie-locale, **no** `/[locale]` segment) · self-hosted fonts (Source Serif 4 / JetBrains Mono /
Noto Serif TC) · Vercel hosting · Cloudflare DNS (`sightlab.fysight.biz`). Mac harness (Python +
`claude -p` + `push_html.sh`) is the data producer; it is NOT in this repo.

```
sightlab/
├── LICENSE
├── README.md
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── tailwind.config.ts
├── middleware.ts                      # session refresh + coarse gating (NOT content gating)
├── .env.example                       # see §11
├── .env.local                         # gitignored
├── docs/
│   ├── PLAN.md                         # this file
│   └── PLAN_REVIEW.md                  # historical review of the v1 paid plan (superseded by §15)
├── messages/
│   ├── en.json                         # UI strings (identical key tree, CI-enforced)
│   └── zh.json
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 0001_init.sql               # tables + indexes + RLS + triggers
│       ├── 0002_rpcs.sql               # get_latest / by_slug / list RPCs (SECURITY DEFINER)
│       └── 0003_billing.sql            # subscriptions, stripe_events, reconcile_role()
├── public/
│   ├── fonts/                          # SourceSerif4*.woff2, JetBrainsMono*.woff2, NotoSerifTC*.woff2
│   ├── favicon.ico
│   └── og/                             # static OG images
└── src/
    ├── app/
    │   ├── layout.tsx                  # <html>, no-flash theme script, font vars, NextIntl provider
    │   ├── globals.css                 # CSS-variable tokens (§4), @font-face, base type
    │   ├── (marketing)/
    │   │   ├── layout.tsx              # public masthead/footer
    │   │   ├── page.tsx                # / landing
    │   │   ├── pricing/page.tsx        # /pricing
    │   │   └── paper/page.tsx          # /paper — ProtectedReader (§9)
    │   ├── (app)/
    │   │   ├── layout.tsx              # app shell: M00 wordmark + theme + lang toggles
    │   │   ├── dispatch/
    │   │   │   ├── page.tsx            # /dispatch → redirect to latest date
    │   │   │   └── [date]/page.tsx     # SERVER paywall lives here (§6)
    │   │   ├── archive/page.tsx        # /archive — paid-only (history list)
    │   │   └── account/page.tsx        # /account — auth-only (billing portal link)
    │   ├── (auth)/
    │   │   ├── layout.tsx              # stripped card layout
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   └── actions.ts             # signIn / signUp / signOut server actions
    │   ├── auth/callback/route.ts      # code→cookie exchange (Route Handler)
    │   └── api/
    │       ├── ingest/route.ts         # Mac → DB (HMAC + bearer, service-role write)
    │       └── stripe/
    │           ├── checkout/route.ts   # create Checkout Session
    │           ├── portal/route.ts     # create Customer Portal session
    │           └── webhook/route.ts    # raw-body webhook → state machine (§8)
    ├── components/
    │   ├── theme/ThemeScript.tsx       # inline no-flash script
    │   ├── theme/ThemeToggle.tsx
    │   ├── i18n/LangToggle.tsx         # cookie flip + router.refresh()
    │   ├── brand/Wordmark.tsx          # M00 treatments A/B/C
    │   ├── dispatch/Masthead.tsx
    │   ├── dispatch/AtAGlance.tsx
    │   ├── dispatch/Section6Table.tsx  # paid-only render
    │   ├── dispatch/Section7Table.tsx  # paid-only render
    │   ├── dispatch/CycleBadge.tsx     # free-safe (stage + confidence only)
    │   ├── dispatch/LockedRegion.tsx   # blurred SKELETON, takes ZERO data props
    │   ├── dispatch/CaveatNote.tsx     # hardcoded §11 model-limitation boilerplate
    │   ├── paper/ProtectedReader.tsx
    │   └── ui/ (Button, Pill, Card, Badge, Bar)
    └── lib/
        ├── supabase/server.ts          # cookie-bound user client (RLS in force)
        ├── supabase/client.ts          # browser client
        ├── supabase/middleware.ts      # session refresh helper
        ├── supabase/admin.ts           # SERVICE ROLE — imported ONLY by ingest + webhook
        ├── auth/getSession.ts          # { user, role: 'free'|'paid' }
        ├── dispatch/queries.ts         # getLatest / getByDate / listHistory via RPC
        ├── dispatch/types.ts           # Dispatch / FlowRow / SectorRow / Bilingual (§5)
        ├── i18n/request.ts             # next-intl cookie locale resolver
        ├── i18n/pick.ts               # pick(b: Bilingual) => b[locale]
        ├── stripe/client.ts
        ├── ingest/schema.ts            # zod validation of POST body (§5/§7)
        └── content/caveat.ts           # the constant caveat text (ZH+EN)
```

---

## 3. Data model

### 3.1 Tables, indexes, RLS, trigger (`0001_init.sql`)

**Naming decision (resolves recon-3 flag):** the spec's `flows_§6` / `cycle_§7` are stored as
`flows_section6` / `cycle_section7`. Non-ASCII identifiers force double-quoting everywhere and break
tooling; the `§6/§7` provenance is preserved in column comments. This is the accepted rename.

```sql
-- profiles: one row per auth user, role is webhook-controlled
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  role                text not null default 'free' check (role in ('free','paid')),
  stripe_customer_id  text unique,
  locale              text default 'en' check (locale in ('en','zh')),
  created_at          timestamptz not null default now()
);
create index profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);

-- auto-create a profile row on signup
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- dispatches: free teaser cols (bilingual prose) + PAID jsonb cols
create table public.dispatches (
  id              uuid primary key default gen_random_uuid(),
  dispatch_date   date not null unique,                 -- the slug; one per UTC day
  generated_at    timestamptz not null,
  published       boolean not null default true,
  -- FREE columns (served to anyone) — bilingual prose:
  intro_en        text, intro_zh        text,
  at_a_glance_en  text, at_a_glance_zh  text,
  -- free-safe scalar badge (stage + confidence, NO scores/tables):
  cycle_badge     jsonb,                                 -- { stage_num, templeton_stage, confidence }
  -- PAID columns (NEVER served to non-paid):
  flows_section6  jsonb,                                 -- §6 weekly fund-flows: rows + numbers + table2 prose
  cycle_section7  jsonb,                                 -- §7 cycle: sectors, dispersion, composite, overlays + prose
  teaser_en       text, teaser_zh       text,            -- X/Telegram partial teaser
  created_at      timestamptz not null default now()
);
create index dispatches_published_date_idx
  on public.dispatches (dispatch_date desc) where published;

-- subscriptions: PK = stripe sub id; written ONLY by webhook
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

-- stripe_events: idempotency ledger
create table public.stripe_events (
  id           text primary key,                         -- Stripe event id
  type         text,
  processed_at timestamptz not null default now()
);

-- v2 seams (no client read path)
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null, created_at timestamptz not null default now()
);
create table public.telegram_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  telegram_username text, approved boolean default false,
  created_at timestamptz not null default now()
);

-- RLS: deny-by-default everywhere
alter table public.profiles        enable row level security;
alter table public.dispatches      enable row level security;  -- NO select policy → RPC-only
alter table public.subscriptions   enable row level security;
alter table public.stripe_events   enable row level security;  -- service-role only
alter table public.waitlist        enable row level security;
alter table public.telegram_members enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = user_id);
create policy waitlist_insert_anon on public.waitlist
  for insert with check (true);                           -- insert allowed, SELECT never
-- profiles/subscriptions have NO insert/update policy: role is webhook-only (service role bypasses RLS).
```

### 3.2 The gating pattern — `SECURITY DEFINER` RPC (recon-3 Pattern A)

RLS gates **rows, not columns** — it cannot say "free users see 4 of these 6 columns." So a deny-all
table + a `SECURITY DEFINER` RPC that *builds the JSON projection itself* is the only design that is
both leak-proof and duplication-free. Non-paid callers receive a JSON object that **literally does not
contain** `flows_section6` / `cycle_section7`. `is_locked: true` tells the UI to render the paywall —
but the lock is real (data absent), not CSS.

```sql
-- 0002_rpcs.sql — the ONLY read path for dispatches
create function public.current_role_is_paid() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select role = 'paid' from public.profiles where id = auth.uid()), false);
$$;

create function public.project_dispatch(d public.dispatches, paid boolean)
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

create function public.get_latest_dispatch() returns jsonb
  language sql security definer stable set search_path = public as $$
  select public.project_dispatch(d, public.current_role_is_paid())
  from public.dispatches d where d.published order by d.dispatch_date desc limit 1;
$$;

-- B1 FIX: non-paid users get a teaser ONLY for the LATEST published date. Any PAST
-- date returns a locked stub (no prose) — history is paid-only, so a free user cannot
-- walk /dispatch/<old-date> URLs and harvest every past intro + at-a-glance.
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

-- history list: paid-only; non-paid get an empty set (UI shows upsell)
create function public.list_dispatches(p_limit int default 60, p_offset int default 0)
  returns table(dispatch_date date, intro_en text, intro_zh text) -- metadata only, never paid jsonb
  language sql security definer stable set search_path = public as $$
  select d.dispatch_date, d.intro_en, d.intro_zh
  from public.dispatches d
  where d.published and public.current_role_is_paid()
  order by d.dispatch_date desc limit p_limit offset p_offset;
$$;

revoke all on function public.get_latest_dispatch()       from public;
revoke all on function public.get_dispatch_by_slug(text)  from public;
revoke all on function public.list_dispatches(int,int)    from public;
grant execute on function public.get_latest_dispatch()      to anon, authenticated;
grant execute on function public.get_dispatch_by_slug(text) to anon, authenticated;
grant execute on function public.list_dispatches(int,int)   to authenticated; -- not anon
```

App reads go through `lib/dispatch/queries.ts` calling `supabase.rpc(...)` on the **cookie-bound
user client** (RLS + `auth.uid()` in force). The service-role client (`lib/supabase/admin.ts`) is
imported ONLY by `api/ingest` and `api/stripe/webhook`.

### 3.3 Role state — derived, never set directly (`0003_billing.sql`)

```sql
create function public.reconcile_role(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare is_paid boolean;
begin
  select exists(select 1 from public.subscriptions
                where user_id = p_user and status in ('active','trialing'))
    into is_paid;
  update public.profiles set role = case when is_paid then 'paid' else 'free' end
    where id = p_user;
end; $$;
```

Role is recomputed by scanning current `subscriptions` after **every** Stripe event, so out-of-order
webhooks cannot strand a user. `past_due` counts as not-paid.

---

## 4. Design system

### 4.1 CSS-variable tokens (extracted from the locked HTML; amber `#D97706` never changes)

`globals.css` defines `:root` (light "paper") and `.dark` (warm-ink). Tailwind maps these via
`@theme` so utilities like `bg-bg`, `text-muted`, `border-border`, `text-primary` resolve to the vars.

```css
:root {                                  /* LIGHT — "paper" (default) */
  --bg:#F7F4ED; --surface:#EDE7D7; --surface-2:#E5DFCE;
  --text:#1A1814; --text-2:#2C2620; --muted:#8A8074; --border:#C8C0AE;
  --primary:#D97706; --primary-hover:#B85F04; --primary-soft:rgba(217,119,6,.12);
  --success:#0F8A5F; --danger:#C84B31;
}
.dark {                                  /* DARK — "warm ink" */
  --bg:#14110D; --surface:#1F1B14; --surface-2:#2D2820;
  --text:#EFE8DA; --text-2:#D8CFBD; --muted:#A89F8C; --border:#2D2820;
  --primary:#D97706; --primary-hover:#F59E0B; --primary-soft:rgba(217,119,6,.16);
  --success:#10B981; --danger:#C84B31;
}
```

### 4.2 Fonts (free, self-hosted in `public/fonts/`, `next/font/local`)

| Role | Family | Weights | CSS var |
|---|---|---|---|
| Display + body serif | **Source Serif 4** (variable, opsz) | 400, 400i, 500, 600, 700 | `--font-serif` |
| Labels / mono / tables | **JetBrains Mono** | 400, 500, 600 | `--font-mono` |
| CJK serif | **Noto Serif TC** | 500, 700, 900 | `--font-cjk` |

Source Serif 4 covers both display and body (opsz axis scales 10px → 56px) for a monolithic newspaper
feel. CJK text composes `--font-cjk` ahead of the serif in the stack.

### 4.3 Type scale & rhythm

`2xs` 10px · `xs` 11px · `sm` 13px · `base` 15px · `lg` 18px (deck) · `xl` 22px (pull-quote) ·
`4xl` 42px (dispatch headline) · `5xl` clamp(2.125rem,5vw,3.5rem) (hero). Body line-height 1.75;
headline tracking −0.02em; mono label tracking +0.14–0.16em.

### 4.4 Component inventory

- **Masthead** — serif wordmark left + mono dispatch-no./date right, divided by a 2.5px solid `--text`
  rule (thick ink line).
- **Article tag** — bare amber mono uppercase, no bg: `// MARKET CYCLE · §7`.
- **AtAGlance box** — `bg-surface font-mono`, rows `border-b border-dashed` (dotted-leader), amber
  label · muted key · bold value. Free-safe and self-contained.
- **Blockquote** — 3px left `--primary` border, no bg, italic serif.
- **Section6Table / Section7Table** — mono, amber uppercase headers, dashed row borders; §6 uses
  `--success`/`--danger` for flow direction; §7 has inline Weinstein-stage badges + a CSS bar for
  dispersion. **Rendered only on the paid branch.**
- **CycleBadge** — free-safe stage + confidence chip (no scores).
- **LockedRegion** — gradient overlay (`from-bg`) over a blurred **skeleton**; takes **zero data
  props** (it cannot leak — there is nothing to leak). Blur is enhancement, not the boundary.
- **ThemeToggle** — blocking `<head>` script reads `localStorage.theme` before paint → no flash.
- **LangToggle** — two-state pill, cookie flip + `router.refresh()`; `pick(b)=>b[locale]` swaps fields.
- **Wordmark (M00)** — A) `Sight Lab` + amber period (default); B) +mono 9px "Market Intelligence"
  sub-label (masthead); C) `M` + amber `00` mono (tight nav/mobile).

---

## 5. Bilingual CONTENT contract

### 5.1 Determinism law

**Numbers are computed once in Python (deterministic) and are language-neutral.** Only the LLM prose
is bilingual; EN is a translation of the ZH the harness already writes (recon-1 Option A: a second
`claude -p` pass in the Mac run emits `{field_zh, field_en}` so EN/ZH can never numerically diverge).
The model-limitation caveat (§11 appendix, identical every day) is a **hardcoded constant**
(`lib/content/caveat.ts`), not stored per dispatch.

| Field | Source | Bilingual? |
|---|---|---|
| All FlowRow / SectorRow numerics, dispersion, composite, contrarian overlay, valuation A, stage, confidence | Python scripts (deterministic) | no (language-neutral) |
| `intro`, `at_a_glance`, `teaser` | `claude -p` | **yes** |
| §6 `table2_signal` (per-ETF narrative), `core_reading` | `claude -p` | **yes** |
| §7 `sector_judgment` (资金×趋势 + portfolio action), `today_core`, `full_narrative` (weekly only) | `claude -p` | **yes** |

### 5.2 POST body (Mac → `/api/ingest`) — exact harness keys

```jsonc
{
  "dispatch_date": "2026-06-06",
  "generated_at":  "2026-06-06T00:03:11Z",
  // ---- FREE slice ----
  "intro":       { "en": "...", "zh": "..." },
  "at_a_glance": { "en": "...", "zh": "..." },
  "cycle_badge": { "stage_num": 3, "templeton_stage": "...", "confidence": "Medium" },
  "teaser":      { "en": "...", "zh": "..." },
  // ---- PAID slice ----
  "flows_section6": {
    "table1_markdown": "…4-col ETF return table…",
    "rows": [{
      "etf": "XLK", "name_zh": "科技",
      "this_week_return_pct": 1.42, "prev_week_return_pct": 0.30,
      "avg_daily_volume": 0, "vol_change_pct": 0,
      "week_turnover_usd": 0, "ad_signal": "ACCUMULATION", "ad_score": 0.62,
      "signal": { "en": "...", "zh": "..." }          // table2 per-ETF prose
    }],
    "core_reading": { "en": "...", "zh": "..." }
  },
  "cycle_section7": {
    "sectors": [{
      "symbol": "XLK", "distance_pct": 7.8, "slope_pct": 0.9,
      "weinstein_stage": 2, "trend_score": 0, "vol_ratio_5d_20d": 1.1,
      "volume_flag": "confirmed_breakout", "in_std": true,
      "judgment": { "en": "...", "zh": "..." }        // 资金×趋势 + portfolio action
    }],
    "dispersion": { "dispersion_index": 4.6, "dispersion_label": "...",
                    "stage_spread": 2, "sector_ranking": ["XLK","SMH","..."] },
    "composite": { "composite_score": -1, "composite_precise": -0.74,
                   "templeton_stage": "...", "cycle_stage_num": 3,
                   "confidence": "Medium",
                   "confidence_breakdown": { /* rule-based */ },
                   "contrarian_overlay": { /* V + S scores */ },
                   "valuation_a_score": 0,
                   "layer_totals": { /* 8-layer composite */ } },
    "today_core":     { "en": "...", "zh": "..." },
    "full_narrative": { "en": "...", "zh": "..." }     // weekly/triggered only; may be null
  }
}
```

The ingest endpoint maps `intro/at_a_glance/teaser/cycle_badge` to the dispatch table's free columns
and `flows_section6/cycle_section7` to the paid JSONB columns.

### 5.3 Teaser vs full split (the boundary)

- **FREE / anon** — `get_*` RPC returns `{dispatch_date, generated_at, intro_*, at_a_glance_*,
  cycle_badge, is_locked:true}`. No rows, no numbers, no scores. The at-a-glance prose is written to
  *tell the story* ("tech ACCUMULATION, energy DISTRIBUTION, 阶段3 medium confidence, XLK leading by
  8pp vs XLE") without being a substitute for the tables.
- **PAID** — same plus `flows_section6` + `cycle_section7` + full history.
- **Distribution teasers** (X / Telegram) use only the `teaser_*` field — never the paid JSONB.

---

## 6. Next.js routing / i18n / middleware / server-side paywall

### 6.1 Routes & route groups

`(marketing)` → `/`, `/pricing`, `/paper` (own public layout). `(app)` → `/dispatch` (redirect to
latest), `/dispatch/[date]`, `/archive`, `/account` (own app shell with toggles). `(auth)` →
`/login`, `/signup` + `actions.ts`. `/auth/callback` is a Route Handler (code→cookie). `api/` →
`ingest`, `stripe/{checkout,portal,webhook}`.

### 6.2 i18n — cookie locale, **no** `/[locale]` segment

The toggle is a reading preference, not navigation. A `/[locale]` segment would double every path and
complicate paywall/Stripe/share URLs to benefit only a few public marketing pages (paid content is not
an SEO asset). `next-intl` resolves locale from a `locale` cookie (`lib/i18n/request.ts`).
`messages/{en,zh}.json` hold UI strings with an identical key tree (CI check fails on key drift).
Dispatch CONTENT is bilingual on the row; `pick(b)=>b[locale]` selects the prose; numbers are neutral.

### 6.3 Middleware — two jobs only (`middleware.ts`)

1. Supabase session refresh on every matched request.
2. **Coarse** gating: `/account` = auth-only (redirect to `/login`); `/archive` = paid-only (redirect
   to `/pricing`). **`/dispatch/[date]` is deliberately NOT gated** — free users must land on it and
   see teaser + locked region, not be bounced. Matcher **excludes** `api/ingest` and
   `api/stripe/webhook` (machine calls, own secrets; webhook needs the raw body).

### 6.4 Server-side paywall (the load-bearing part) — `/dispatch/[date]/page.tsx`

A **Server Component** that (1) resolves role via `getSession()` *before* fetching, then (2) calls the
single RPC `get_dispatch_by_slug(date)` on the cookie-bound user client. The RPC already projects by
role, so a non-paid request never receives `flows_section6`/`cycle_section7`. Render branches: paid →
`<Section6Table>`/`<Section7Table>`; non-paid → `<CycleBadge>` + `<LockedRegion>` (zero data props).
Three defense layers: (a) **RPC column omission** (primary — bytes never serialized); (b) RLS deny-all
on the base table (a stolen anon key + `select('*')` returns zero rows); (c) `<LockedRegion>` renders
a blurred skeleton, never real data. Role derives from the `subscriptions` row written only by the
Stripe webhook — the client can never set its own role.

---

## 7. Daily Mac → Supabase ingestion + distribution

### 7.1 Mac side (only two genuinely new files)

A new launchd runner `com.sightlab.dispatch` fires **00:05 UTC** (5 min before daily-news to avoid
OpenD/FMP collision) → `run_sightlab_dispatch.sh`, which:

1. runs the three existing scripts verbatim — `query_weekly_flows.py --json`,
   `query_sector_dispersion.py --json`, `compute_fast_monitor.py --json` (Sunday also
   `compute_composite_score.py --snapshot-type weekly`);
2. **`assemble_dispatch.py`** (new) builds structured `dispatch.json` from those outputs;
3. a second `claude -p` pass **translates ZH prose → EN** into `{en,zh}` pairs (numbers untouched);
4. POSTs the bilingual `dispatch.json` to `$SIGHTLAB_INGEST_URL`.

Every step `die()`s to a Telegram **DM** on failure (no partial dispatch is POSTed). All work in
`$DATA_DIR/sightlab` — **never `~/Documents`** (launchd can't read it under TCC). launchd reruns a
missed job on wake → a sleeping Mac means *late, not lost*. A watchdog (clone of
`dailynews_watchdog.sh`) at ~01:30 UTC DMs on a miss.

### 7.2 `/api/ingest` contract + auth (`api/ingest/route.ts`)

- **Auth (server-side only):** `Authorization: Bearer $SIGHTLAB_INGEST_SECRET` **plus** an
  **HMAC-SHA256 over the raw body** (verified *before* JSON parse) keyed on `$SIGHTLAB_INGEST_HMAC_KEY`,
  **plus** a date-guard header that must equal `dispatch_date` and be within ±1 day.
- **Write:** Supabase **service-role key** (Vercel-only, never on the Mac).
- **Idempotency:** `dispatch_date` is unique → re-POST is an **upsert** (free backfill / re-run clears
  the "Delayed" banner).
- **Validation:** `lib/ingest/schema.ts` (zod) enforces the §5.2 shape; reject → 422 (Mac DMs).

### 7.3 Distribution

- **Telegram (v1):** reuse `push_html.sh` unchanged; push **only the free teaser slice** to a **new**
  invite-only channel `$SIGHTLAB_TELEGRAM_CHANNEL_ID` — explicitly **NOT** the DM (`REDACTED_DM`) and
  **NOT** the daily-news channel (both reserved by CLAUDE.md).
- **X (v2, flagged for COST):** reliable posting needs the X API **Basic tier ≈ $100/mo**; the free
  tier is unusable. **v1 writes a copy-paste `teaser.txt` (EN+ZH)** instead. v2 adds a gated
  `post_x.py` (step 9) keyed on `$SIGHTLAB_X_BEARER`, reusing the same teaser text — no later refactor.

---

## 8. Stripe billing flow + webhook → DB state machine

### 8.1 Products / prices

One product "SightLab Subscription", two prices: monthly `unit_amount=1500` and yearly
`unit_amount=16200` (the 10% discount is baked into the amount — **no coupon lifecycle**).

### 8.2 Flow

`/pricing` → `POST /api/stripe/checkout` (server creates a Checkout Session, sets
`client_reference_id = user.id` and `metadata.supabase_user_id`, `success_url`/`cancel_url`) → Stripe
hosted Checkout → webhook drives DB → `/account` links to `POST /api/stripe/portal` (Customer Portal
for plan change / cancel / card update).

### 8.3 Webhook state machine (`api/stripe/webhook/route.ts`) — single source of truth = `reconcile_role`

Verify signature on the **raw body**. Open a transaction; `insert into stripe_events(id) on conflict
do nothing` — if 0 rows inserted, it's a duplicate → ack 200 and stop. Process inside the **same
transaction** so a thrown error rolls back the event insert too (Stripe's retry is not wrongly
short-circuited). After any subscription mutation, call `reconcile_role(uid)`.

| Event | Action |
|---|---|
| `checkout.session.completed` | Resolve uid via `client_reference_id` / `metadata`. Set `profiles.stripe_customer_id` from `session.customer`. Upsert sub if retrievable. `reconcile_role(uid)`. |
| `customer.subscription.created` | Upsert `subscriptions` (PK `stripe_subscription_id`): status, `price_id`, `interval`, `current_period_end`, `cancel_at_period_end`. `reconcile_role`. |
| `customer.subscription.updated` | Same upsert (status / plan-switch / cancel toggle). `reconcile_role`. |
| `customer.subscription.deleted` | Set `status='canceled'` (keep row for history). `reconcile_role` → drops to free unless another active sub exists. |
| `invoice.paid` | Set `status='active'`, refresh `current_period_end`. `reconcile_role` → paid. (Renewals + past_due recovery.) |
| `invoice.payment_failed` | Set `status='past_due'`. Do NOT immediately revoke — `reconcile_role` treats `past_due` as not-paid, so access lapses naturally; `invoice.paid` restores it. |

Role never comes from a single event; it's always recomputed by scanning current `subscriptions`.

---

## 9. Protected in-app paper reader (`/paper` + `components/paper/ProtectedReader.tsx`)

The methodology paper is a public, half-open-source HTML page (no PDF). A client `ProtectedReader`
wrapper applies: `user-select:none`; prevented `contextmenu`/`copy`/`cut`/`dragstart`;
`draggable=false`; `@media print { body { display:none } }`. **Honest limit (documented in-page):**
screenshots cannot be blocked — this is discouragement, not DRM — so the **proprietary thresholds /
weights / exact layer formulas stay OFF this page**. It explains the *method* (Weinstein staging,
A/D scoring intuition, dispersion concept, the "confirmer-not-predictor" framing) without shipping
the numbers that make it copyable.

---

## 10. Phased build plan (each phase = files + a concrete DONE)

### Phase A — Scaffold + theme + i18n
- **Files:** `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`,
  `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `public/fonts/*`,
  `components/theme/{ThemeScript,ThemeToggle}.tsx`, `components/i18n/LangToggle.tsx`,
  `lib/i18n/{request,pick}.ts`, `messages/{en,zh}.json`, `components/brand/Wordmark.tsx`, `(marketing)/page.tsx`.
- **DONE:** `npm run dev` serves `/` with the editorial look; light↔dark toggles with **no flash** on
  reload; EN↔中文 toggle swaps UI strings via cookie; all three fonts load self-hosted; `npm run build`
  passes typecheck.

### Phase B — Auth + schema + RLS
- **Files:** `supabase/migrations/0001_init.sql`, `0002_rpcs.sql`, `0003_billing.sql`,
  `lib/supabase/{server,client,middleware,admin}.ts`, `lib/auth/getSession.ts`, `middleware.ts`,
  `(auth)/{login,signup}/page.tsx`, `(auth)/actions.ts`, `app/auth/callback/route.ts`, `(app)/account/page.tsx`.
- **DONE:** migrations apply on a fresh Supabase project; email+password signup auto-creates a
  `profiles` row (role `free`) via trigger; login sets a cookie session; `getSession()` returns
  `{user, role}`; `/account` is auth-gated by middleware; a raw `from('dispatches').select('*')` with
  the anon key returns **zero rows** (RLS deny-all verified).

### Phase C — Dispatch pages + server paywall
- **Files:** `lib/dispatch/{types,queries}.ts`, `(app)/dispatch/page.tsx`,
  `(app)/dispatch/[date]/page.tsx`, `(app)/archive/page.tsx`,
  `components/dispatch/{Masthead,AtAGlance,Section6Table,Section7Table,CycleBadge,LockedRegion,CaveatNote}.tsx`,
  `lib/content/caveat.ts`. (Seed one dispatch row manually via SQL for testing.)
- **DONE:** with a seeded row, an anon/free session at `/dispatch/<date>` shows intro + at-a-glance +
  CycleBadge + LockedRegion and the network response contains **no** `flows_section6`/`cycle_section7`
  (verified in DevTools); flipping that user's `profiles.role` to `paid` renders the full §6/§7 tables;
  `/archive` redirects free → `/pricing`, lists history for paid; `/dispatch` redirects to latest date.

### Phase D — Stripe
- **Files:** `lib/stripe/client.ts`, `api/stripe/{checkout,portal,webhook}/route.ts`,
  `(marketing)/pricing/page.tsx`, account-page portal button.
- **DONE:** Checkout (test mode) completes → webhook upserts `subscriptions` → `reconcile_role` flips
  the user to `paid` → §6/§7 unlock with no manual DB edit; `stripe trigger` replay of the same event
  is a no-op (idempotency); cancel via Portal → `subscription.deleted` → role back to `free`;
  `payment_failed` → `past_due` → access lapses, then `invoice.paid` restores it.

### Phase E — Ingestion endpoint + Mac script
- **Files (repo):** `api/ingest/route.ts`, `lib/ingest/schema.ts`.
  **Files (Mac, `$DATA_DIR/sightlab/`, not in repo):** `assemble_dispatch.py`,
  `run_sightlab_dispatch.sh`, launchd plist `com.sightlab.dispatch`, watchdog clone, `~/.config/sightlab/.env`.
- **DONE:** a real Mac run POSTs a valid bilingual dispatch; bad bearer **or** bad HMAC **or** out-of-range
  date → 401/422 with no DB write; a valid POST upserts the row (re-POST same date overwrites, no
  duplicate); the free teaser slice lands in the new Telegram channel; `teaser.txt` (EN+ZH) is written
  for manual X posting; `/dispatch` shows the freshly ingested day end-to-end.

### Phase F — Paper page + draft
- **Files:** `(marketing)/paper/page.tsx`, `components/paper/ProtectedReader.tsx`, paper content (MDX or
  TSX), the honest-limit note.
- **DONE:** `/paper` renders the methodology; right-click / copy / cut / drag / print are blocked
  (print shows blank); the documented screenshot caveat is present; no proprietary thresholds/weights/
  formulas appear in the source.

### Phase G — Polish / SEO
- **Files:** `app/robots.ts`, `app/sitemap.ts`, per-route `metadata`/OG (`public/og/*`), `README.md`,
  loading/error/not-found states, the CI key-tree check for `messages/*.json`, accessibility pass.
- **DONE:** Lighthouse SEO + a11y ≥ 90 on `/` and `/pricing`; OG cards render in a validator; `/dispatch`
  pages are `noindex` (paid content not an SEO asset); a "Delayed" banner shows when the latest dispatch
  is > 24h stale and clears on re-ingest; production build deploys to Vercel on `sightlab.fysight.biz`.

---

## 11. `.env.example` (every key, grouped; values blank)

```dotenv
# =========================================================================
# VERCEL-SIDE (set in Vercel project env; .env.local for local dev)
# =========================================================================
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=            # https://<ref>.supabase.co (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # anon public key (RLS-bound, safe in browser)
SUPABASE_SERVICE_ROLE_KEY=           # SERVER ONLY — bypasses RLS; ingest + webhook only
SUPABASE_JWT_SECRET=                 # for verifying Supabase JWTs server-side (optional)
SUPABASE_DB_URL=                     # postgres connection string for migrations/CI

# --- Stripe ---
STRIPE_SECRET_KEY=                   # sk_live_… / sk_test_… (server only)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # pk_… (browser)
STRIPE_WEBHOOK_SECRET=               # whsec_… (verify raw-body signature)
STRIPE_PRICE_MONTHLY=                # price_… for $15/mo (unit_amount 1500)
STRIPE_PRICE_YEARLY=                 # price_… for $162/yr (unit_amount 16200)

# --- App ---
NEXT_PUBLIC_SITE_URL=                # https://sightlab.fysight.biz
SIGHTLAB_INGEST_SECRET=              # bearer token the Mac sends to /api/ingest (shared w/ Mac)
SIGHTLAB_INGEST_HMAC_KEY=            # HMAC-SHA256 key over the raw ingest body (shared w/ Mac)

# --- v2 seams (leave blank in v1) ---
TELEGRAM_BOT_TOKEN=                  # v2: server-side auto-post (v1 posts from the Mac)
SIGHTLAB_TELEGRAM_CHANNEL_ID=        # v2 server path; v1 uses the Mac-side copy of this
X_API_KEY=                           # v2 (Basic tier ≈ $100/mo)
X_API_SECRET=                        # v2
X_ACCESS_TOKEN=                      # v2
X_ACCESS_SECRET=                     # v2

# =========================================================================
# MAC-SIDE  (~/.config/sightlab/.env, chmod 600 — NEVER the service-role key)
# =========================================================================
SIGHTLAB_INGEST_URL=                 # https://sightlab.fysight.biz/api/ingest
SIGHTLAB_INGEST_SECRET=              # MUST equal the Vercel SIGHTLAB_INGEST_SECRET
SIGHTLAB_INGEST_HMAC_KEY=            # MUST equal the Vercel SIGHTLAB_INGEST_HMAC_KEY
SIGHTLAB_TELEGRAM_CHANNEL_ID=        # NEW invite-only channel (NOT DM REDACTED_DM, NOT daily-news)
FMP_API_KEY=                         # reused from the existing harness
ANTHROPIC_API_KEY=                   # for the ZH→EN translation claude -p pass (optional if using `claude` CLI)
# Reused from the existing harness for FAILURE ALERTS ONLY (not content):
#   TELEGRAM_API_KEY  + TELEGRAM_CHAT_ID  (the DM, $CONFIG_DIR/.env)
SIGHTLAB_X_BEARER=                   # v2 only — leave unset in v1
```

---

## 12. Risks

1. **TCC / launchd cannot read `~/Documents`.** Mitigated: all Mac work lives in `$DATA_DIR/sightlab`.
   A drift back into `~/Documents` silently breaks the cron. (Known harness footgun.)
2. **Sleeping Mac = late dispatch.** launchd reruns missed jobs on wake → late, not lost; watchdog DMs
   on a miss; site degrades to latest + "Delayed" banner. But a Mac off for days = stale data.
3. **EN/ZH numeric divergence.** Eliminated by design: numbers computed once in Python; LLM only
   translates prose. If anyone later lets the LLM "regenerate" numbers, this breaks — keep the wall.
4. **Paid-data leak.** Primary defense is RPC column omission + RLS deny-all (bytes never serialized).
   The risk is a future dev adding a `select('*')` path or exposing the service-role client beyond
   `admin.ts` — enforce via review + a test asserting the anon `select('*')` returns zero rows.
5. **Webhook out-of-order / replays.** Handled by `reconcile_role` (derive from current subs) + the
   `stripe_events` idempotency ledger in the same transaction. Risk if someone processes outside that
   transaction.
6. **X API cost.** $100/mo Basic tier for reliable posting is real; v1 sidesteps with `teaser.txt`.
   Decision deferred — flagged for the user.
7. **Service-role key exposure.** It lives only on Vercel (server) and is imported only by
   `admin.ts`. It must NEVER reach the Mac (the Mac only holds the ingest bearer + HMAC key).
8. **Cloudflare proxy vs Vercel.** If the `sightlab` record is left "proxied" (orange cloud) it can
   conflict with Vercel's TLS/edge; use DNS-only (grey cloud) per §13.
9. **Screenshot of the paper.** Cannot be prevented; mitigated by keeping proprietary numbers off the
   page (honest discouragement, not DRM).
10. **i18n key drift** between `en.json`/`zh.json` → missing-string bugs. Mitigated by the Phase G CI
    key-tree check.

---

## 13. WHAT THE USER MUST DO

1. **Supabase project** — create it; copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, the DB connection string (`SUPABASE_DB_URL`), and (optional)
   `SUPABASE_JWT_SECRET`. Enable Email auth (email+password; confirm-email on or off as preferred).
   Run the three migrations.
2. **Stripe** — create one product "SightLab Subscription" with two recurring prices: **$15/mo**
   (`unit_amount 1500`) and **$162/yr** (`unit_amount 16200`). Copy the two price IDs
   (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`), the secret + publishable keys, and after creating
   the webhook endpoint (`/api/stripe/webhook`) the signing secret (`STRIPE_WEBHOOK_SECRET`). Enable
   the Customer Portal in Stripe settings.
3. **Vercel project** — import the repo, set framework = Next.js, add the production domain
   `sightlab.fysight.biz`, paste every Vercel-side env var from §11.
4. **Cloudflare DNS** for `sightlab.fysight.biz` (parent `fysight.biz` already owned):
   - Add a **CNAME** record: name `sightlab`, target `cname.vercel-dns.com`, **Proxy status = DNS only
     (grey cloud)** — not proxied. (If Vercel instead shows an A record, follow Vercel's exact value;
     prefer the CNAME it gives you.)
   - In Vercel's domain panel, confirm the domain verifies and TLS is issued.
5. **Fill `.env`** — Vercel-side in the Vercel dashboard; Mac-side in `~/.config/sightlab/.env`
   (`chmod 600`). `SIGHTLAB_INGEST_SECRET` and `SIGHTLAB_INGEST_HMAC_KEY` must be **identical** on both
   sides. The service-role key goes **only** on Vercel.
6. **Private Telegram channel** — create a NEW invite-only channel (NOT the DM `REDACTED_DM`, NOT the
   daily-news channel `REDACTED_CHANNEL`), add `@YOUR_BOT` as admin, and put its chat id in
   `SIGHTLAB_TELEGRAM_CHANNEL_ID` (Mac side for v1). Member approval is manual.
7. **X API decision** — decide whether to pay for the **Basic tier (~$100/mo)** to enable auto-posting
   in v2. Until then, v1 produces a `teaser.txt` to copy-paste manually. No code change is needed to
   defer; the `post_x.py` seam is ready for when you say go.

---

## 14. Review fixes (LOCKED — apply ALL; override earlier prose on conflict)

Every item below is mandatory. Derived from `docs/PLAN_REVIEW.md`. Verify phases check these.

### 14-B Blockers (the paywall must not leak)
- **B1 — history-teaser leak.** FIXED inline in §3.2: `get_dispatch_by_slug` now gates non-paid
  callers to the LATEST published date only; any past date → locked stub (no prose). Build the SQL
  exactly as written in §3.2. Add a test: a free user calling the RPC for a non-latest date gets a
  stub with no `intro_*`/`at_a_glance_*`.
- **B2 — one gating mechanism only.** The `SECURITY DEFINER` RPC projection (§3.2) is the SOLE read
  path for dispatches. recon-04's `dispatches_public` VIEW + per-role `.select('col list')` design is
  **SUPERSEDED — do not build it.** App code MUST NEVER call `.from('dispatches').select(...)`; only
  `supabase.rpc('get_latest_dispatch'|'get_dispatch_by_slug'|'list_dispatches', ...)`. A grep for
  `from('dispatches')` in `src/` must return zero hits (CI check).
- **B3 — composite_score is PAID.** The free `cycle_badge` is `{stage_num, templeton_stage,
  confidence}` ONLY — never `composite_score`/`composite_precise`/layer totals/dispersion_index. Those
  live in the PAID `cycle_section7`. The at-a-glance prose AND the X/Telegram teaser MUST NOT state any
  §7 numeric score (no "composite +2", no dispersion number) — only qualitative labels (stage,
  ACCUMULATION/DISTRIBUTION, leader/laggard direction). Enforce in the zod schema (reject a
  `cycle_badge` carrying score keys) and document the at-a-glance writing rule.
- **B4 — definer role test.** Add an automated test proving `auth.uid()` resolves correctly inside the
  `SECURITY DEFINER` RPCs invoked via PostgREST `rpc()`: paid JWT → paid projection (has
  `flows_section6`); free JWT → no paid keys; anon → teaser/null. A misconfig that makes everyone
  `free` (or everyone `paid`) must fail the build.
- **B5 — HMAC byte-identical.** `/api/ingest`: `const raw = await req.text()` FIRST, HMAC-SHA256 that
  exact string, compare constant-time, THEN `JSON.parse(raw)`. Never `req.json()` before the HMAC. The
  Mac must sign the EXACT bytes it sends — read the file directly on both sides
  (`openssl dgst -sha256 -hmac "$KEY" < "$F"` and `curl --data-binary @"$F"`); no `$(cat …)` round-trip
  (it strips the trailing newline → 401 on every valid run). Constant-time compare for the bearer too.

### 14-C Concerns (fold in)
- **C1 — fail-closed bilingual + EN-soft-fail.** zod requires both `en` and `zh` NON-EMPTY on every
  prose field → else 422. EXCEPTION: `full_narrative` may be wholly null (weekday), but if present both
  langs required. **EN-translation failure does NOT drop the dispatch:** ship ZH-complete with
  `en_pending=true`, render ZH as the EN fallback, backfill EN on re-POST. (Per the accepted Mac
  guardrail — never let a translation hiccup blank the whole paid product.)
- **C2 — bind the harness↔contract schema.** `assemble_dispatch.py` is the ONE place script keys map to
  the §5.2 contract; write it against the REAL script output. **Before Phase E, dump
  `compute_fast_monitor.py --json` (and re-confirm `query_weekly_flows.py`/`query_sector_dispersion.py`
  keys) for real and pin them** — recon only documented the composite script, not the fast monitor.
  Map `ticker`/`ticker_label_zh`/`"US.SPY"`-style keys → contract `etf`/`name_zh`. Translate the
  `dispersion_label` enum (高/中/低) to `{zh,en}`. No camelCase invented fields (recon-04's
  `nameZh/bucket/crossRead` do not exist).
- **C3 — single role source.** `getSession()` reads `profiles.role` ONLY (the webhook-maintained
  truth). NEVER derive paid/free from a `subscriptions` row in app code. Delete recon-04's
  `getUserAndRole`/`maybeSingle()` approach.
- **C4 — Stripe field + reconcile fallback.** Pin `apiVersion` in the Stripe SDK init. Read
  `current_period_end` from the invoice line `period.end` (it moved off the sub top-level). On
  `/account` load, if `profiles.stripe_customer_id` is set but `role='free'`, re-query Stripe for active
  subs server-side and `reconcile_role` — insurance against a stuck paying customer.
- **C5 — one Customer per user.** Create the Stripe Customer once, write `stripe_customer_id` back
  before Checkout, reuse it after; use Stripe idempotency keys on Customer + Checkout Session creation.
- **C7 — no caching of per-role renders.** `/dispatch`, `/dispatch/[date]`, `/archive`, `/account` MUST
  be `export const dynamic = 'force-dynamic'` (or `revalidate = 0`) and send `Cache-Control: private,
  no-store`. NO `revalidate`/`unstable_cache`/ISR on these. Marketing + `/paper` may cache. Phase G:
  `curl` as anon and assert no paid bytes + `no-store`.
- **C8 — RSC/flight payload audit.** The free branch must construct ZERO objects containing
  `flows_section6`/`cycle_section7` (not even passed to a parent layout/client component for a date or
  count). Phase C DONE: grep the served HTML AND the `__next_f` flight chunks for a known paid token
  (e.g. a ticker `ad_score`) — must be absent on the free render.
- **C9 — email confirmation ON + email synced.** Enable email confirmation in Supabase (reduces abuse).
  `handle_new_user` stores `email` on `profiles`; keep it the canonical display email (or always join
  `auth.users` — pick storing-on-profiles and don't half-do it).
- **C10 — paper protection that doesn't punish honest readers.** Keep `user-select:none` + prevented
  `copy/cut/contextmenu/dragstart` + the honest screenshot caveat. **DROP** `@media print{body{display:none}}`
  (it blanks the page for legit offline readers and stops nothing). The REAL protection is keeping
  proprietary thresholds/weights/formulas OFF the page.

### 14-S Suggestions (adopt)
- **S1** validate `schema_version` on ingest; reject unknown → 400.
- **S2** the RLS/paywall guarantees are COMMITTED CI TESTS, not manual checks: (a) anon
  `from('dispatches').select('*')` → 0 rows; (b) free RPC response has no paid keys; (c) `from('dispatches')`
  absent from `src/`. Build fails on regression.
- **S3** keep `published boolean` + `dispatch_date` as the slug (no separate `status` enum / `slug`
  column). Make the one migration internally consistent (supersede recon-03's enum variant).
- **S4** `waitlist` gets `unique(email)` + a basic rate-limit; rate-limit `/api/ingest` too.
- **S7** pin the Stripe `apiVersion` (same as C4).
- **S8** the Telegram teaser is the free slice — it carries NO composite/scores (same rule as B3).

### 14-M Mac-origin guardrails (v1, user-accepted)
The single-Mac origin is accepted for v1 with these REQUIRED bounds:
1. **Manual-rerun runbook** committed before launch: `bash run_sightlab_dispatch.sh` backfills a missed
   day (idempotent upsert clears the "Delayed" banner).
2. **OpenD-up / data-fresh watchdog** (not just "dispatch-landed") — DM if OpenD is logged out or data
   is stale at run time.
3. **EN-soft-fail** (C1) — a translation failure ships ZH-only, never blanks the dispatch.
4. **Pricing copy sets the expectation:** "dispatches target 00:00 UTC; occasional delays happen" — a
   late day is a known property, not a broken promise.
- `assemble_dispatch.py` stays **host-agnostic** (no Mac-only assumptions) so moving to an always-on
  runner later is a deploy, not a rewrite. (§7 FMP path needs no OpenD — natural first thing to lift to
  cloud if SightLab gets traction.)

---

## 15. v3 — Open-source / free pivot (2026-06-06; SUPERSEDES the paid model)

SightLab is now a **free, open-source (AGPL-3.0) research lab**, not a paid SaaS. The paid model
(§8 Stripe + the role-gated content paywall in §3.2/§6.4) is **PARKED** — kept in the repo, not
wired, reserved for a possible future tier. Deltas below WIN over earlier sections on conflict.

**15.1 Content fully public.** *(NARROWED by §15.9: the deep-read body is the one login-gated content.)* Anon + everyone sees the COMPLETE §6/§7 dispatch + all history. The
read RPCs return the full projection to all callers (no `is_locked` for content). The paywall
projection functions stay in the migrations as PARKED (commented "reserved"); the active read path
returns full content. The dispatch page renders §6/§7 for everyone; no content LockedRegion.

**15.2 Auth = free account for DISTRIBUTION, not content.** *(AMENDED by §15.9: also unlocks the deep-read body. AMENDED 2026-07-03: the email opt-in is gone with §15.3.)* Signup is free. A logged-in user gets
the **Telegram invite link** (env `SIGHTLAB_TELEGRAM_INVITE_LINK`, shown only when authenticated;
channel joins moderated manually). `profiles.email_opt_in` remains as an unused column; the `role`
column stays but is PARKED (not used for content). Nothing content-facing is gated by auth.

**15.3 Daily email digest — REMOVED FOR GOOD (2026-07-03).** The original design (Resend fan-out to
`email_opt_in` users after ingest) required a physical postal address in every email (CAN-SPAM), and
exposing a personal address is not acceptable; no compliant sender identity exists, so the feature is
deleted rather than parked: `lib/email/*`, `/api/unsubscribe`, the opt-in action/UI strings, and the
ingest digest step are all removed. Delivery channels are the SITE + the TELEGRAM channel. Auth
magic-link email is unaffected (Supabase sends it via its own SMTP config, not app code). The unused
DB columns (`profiles.email_opt_in`, `dispatches.digest_sent_at`) stay — not worth a migration.

**15.4 🔒 PRIVACY (LOCKED — supersedes any earlier contract).** The dispatch — site, email, Telegram,
X — carries ONLY market-wide §6 (fund flows) + §7 (cycle / dispersion / Weinstein stage +
**market-structure** sector judgment). **REMOVED for good:** the §7 「对持仓的话」/ `holding_note` /
portfolio-action / user-holdings `bucket` fields, and the ENTIRE §8 portfolio block.
`assemble_dispatch.py` reads market data ONLY and must touch NO holdings/portfolio source. A unit test
asserts the dispatch payload (and the ingest zod schema) contains zero holdings fields. The §7
`judgment` field is market commentary ("tech stage-2 confirmed uptrend; energy distributing"), NEVER
"what to do with your position."

**15.5 License → AGPL-3.0** (from MIT): anyone running a modified copy, incl. as a service, must share
their changes — improvements flow back to the lab.

**15.6 Engineering baseline (NEW):** ESLint + Prettier (configs + `lint`/`format`/`format:check`
scripts); unit tests (vitest) covering the privacy guard, i18n `pick`, the ingest zod fail-closed, and
the dispatch projection; GitHub Actions CI (lint + format:check + typecheck + build + test). CD is the
user's (GitHub side).

**15.7 Research-lab framing:** README + CONTRIBUTING.md + the public methodology paper (§9); landing/
nav copy → "open research; contributions welcome." Pricing removed from nav (page may stay, parked).

**15.8 Privacy scrub (DONE 2026-06-06):** repo docs genericized — personal Telegram ids, bot handle,
GitHub handle, home/infra paths, and holdings tickers redacted to placeholders; `.claude/` gitignored.

**15.9 Market-structure deep-read (2026-06-23 — AMENDS §15.1/§15.2 for ONE section).** A new
`deepread_section` renders below the §6/§7 dispatch: a deeper, PRESENT-STATE read of the same market
data — strong A/D signals, price↑/volume↓ divergence, the hysteresis-suppressed cycle stage, valuation
drag — that SightLab's thin `core_reading` omits. It carries a PUBLIC `teaser` + a login-gated `body`.
This is the ONE place auth gates content: a **free-registration wall** (a signup driver, not a paywall),
narrowing §15.1's "all content public" and §15.2's "nothing content-facing is gated." The core §6/§7
dispatch + all history stay fully public; only the deep-read body needs a (free) login.
- **Gate mechanics:** the body is withheld at RENDER — `DispatchArticle` reads the session server-side
  and passes `body` to `DeepReadSection` ONLY when authenticated; for anon it is `null` and never
  serialized to the client. The blur skeleton is cosmetic, NOT the boundary. (RPC still returns the full
  projection; render-level withholding suffices because the body is market-only, not privacy-sensitive.)
- **Production:** generated deterministically in `assemble_dispatch.py` (`build_deepread_section`,
  bilingual, NO LLM — like `build_weekly_narrative`). ADDITIVE optional ingest field `deepread_section`
  (`schema_version` stays **1** — no version cutover; a pre-§15.9 producer still validates). DB column +
  `project_dispatch_full` updated in migration `0007_deepread.sql`.
- **Writing (sightlab-writing §A3/§D3/§D4):** present-state descriptions ONLY — no "precedes/before it
  tops/due for" forecasts; any top-frame names a falsifiable observable in the same breath; the
  confirmer / model-limitation caveat is kept.
- **🔒 Privacy (§15.4 UNCHANGED):** market-only, NO holdings. The three holdings guards (Mac
  `assert_no_holdings`, ingest `findHoldingsKeys`, email `assertNoHoldings`) still scan it. Holdings-aware
  interpretation of this same data lives ONLY in the private daily-news brief (§8), NEVER on SightLab.
