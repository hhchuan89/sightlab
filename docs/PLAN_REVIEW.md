> **SUPERSEDED.** This review examined the original v1 **PAID** plan (Stripe paywall,
> role-gated content). The v3 open/free pivot (`docs/PLAN.md` §15 — content public,
> AGPL-3.0, billing parked) supersedes the premises below. Kept for historical context;
> do not action findings here without checking §15 first.

# SightLab PLAN.md — Adversarial Review

Reviewed: `docs/PLAN.md` against internal recon notes (not in the repo). Lens: a senior architect signing off
a PAID product before any code is written. The plan is genuinely strong — the RPC-projection
paywall, derive-role-from-subscriptions, and idempotency-in-one-transaction are the right
calls. What follows is only what will actually bite.

---

## BLOCKERS (must fix before building)

### B1. The plan's `get_dispatch_by_slug` LEAKS ALL HISTORY TEASERS to free/anon users
This is the #1 finding and it directly violates a LOCKED spec decision ("all history is PAID-only").

PLAN.md (lines 263-268):
```sql
create function public.get_dispatch_by_slug(p_slug text) returns jsonb ... as $$
  select public.project_dispatch(d, public.current_role_is_paid())
  from public.dispatches d
  where d.published and d.dispatch_date = p_slug::date limit 1;
$$;
```
For a non-paid caller, `project_dispatch(d, false)` returns the teaser projection (intro + at-a-glance + cycle_badge) for **ANY** published date they name — not just today. A free user can walk `/dispatch/2026-05-01`, `/dispatch/2026-05-02`, … and harvest the full intro + at-a-glance prose of every past dispatch. That is exactly the history the spec says is paid-only, and the archive paywall (`/archive` redirect) becomes security theater because the per-date page hands the teasers out directly.

recon-03 already solved this correctly (lines 338-374): a non-paid caller gets the teaser **only if the requested slug is the latest published**, else `null`. The plan regressed that logic when it rewrote the RPC. **Fix: port recon-03's "latest-slug gate" into `get_dispatch_by_slug`.** Decide explicitly whether a free user may even see *today's* teaser at a stable `/dispatch/[date]` URL or only at `/dispatch` (redirect-to-latest); the plan's middleware says `/dispatch/[date]` is ungated for free users, so at minimum today's date must resolve to a teaser and every other date must resolve to locked/null.

### B2. Three mutually-contradictory gating + column designs across the docs — pick ONE, in writing, before coding
The "server-side paywall" is the load-bearing feature, yet the three sources disagree on its mechanism AND on the column shape. A builder following the wrong file ships the leak.

- **recon-03 + PLAN:** RPC projection, columns are `intro_en/intro_zh`, `at_a_glance_en/at_a_glance_zh`, `flows_section6`, `cycle_section7`. Client calls `supabase.rpc(...)`, never `.from('dispatches')`.
- **recon-04:** a `dispatches_public` **VIEW** + two different `.select('col list')` queries (`getTeaser`/`getFullDispatch`) against the base table, columns named `intro`, `at_a_glance`, `confidence`, `flows`, `sectors`, `cycle`. This is recon-03's explicitly **rejected Option C** (per-role `.select()` lists = "one forgotten `.select('*')` from a leak"), plus a `dispatches_public` view that doesn't exist in any migration.

These cannot both be built. recon-04's `getFullDispatch` does `.select('...flows, sectors, cycle')` on the base table as the cookie-bound user — which, under recon-03's deny-all RLS, returns **zero rows for everyone including paid users**, so the paid path is simply broken. The plan's file tree (`queries.ts: getLatest/getByDate/listHistory via RPC`) implies RPC won the fight, but recon-04's `getTeaser/getFullDispatch` + view language is still live and will mislead. **Fix: delete/supersede the recon-04 query+view design in writing; declare the RPC path (recon-03/PLAN) canonical; make the file tree, types, and Phase C DONE-criteria all reference `rpc()` calls, never `.from('dispatches').select()`.**

### B3. `cycle_badge` free column carries top-of-cycle scores the spec wants withheld
The "free-safe" `cycle_badge` is specified inconsistently and one version leaks the proprietary signal. PLAN §3.1 says `cycle_badge = { stage_num, templeton_stage, confidence }` (safe). But recon-05's ingest contract (lines 232-238) defines the at-a-glance `cycle_badge` as `{ composite_score, templeton_stage, cycle_stage_num, confidence, dispersion_label }` — i.e. it ships the **composite_score** to free/anon. The whole §7 product is the composite/dispersion read; handing free users the composite number every day is giving away the headline answer. **Fix: freeze ONE `cycle_badge` shape in the zod schema and the SQL projection, and decide deliberately whether `composite_score` is free or paid. My strong recommendation: keep `composite_score` PAID; free badge = stage label + confidence only.** Note the at-a-glance prose example in the spec literally narrates "composite +2" — so even the prose teaser is leaking the number the table charges for. Tighten the at-a-glance writing rule too.

### B4. `project_dispatch` marked `immutable` while it's selected over table rows — and the role read must be re-confirmed inside SECURITY DEFINER
Two correctness issues in the RPC layer:
- `project_dispatch(d, paid)` is declared `immutable`. It's a pure function of its args, so that's technically OK, but `get_latest_dispatch`/`get_dispatch_by_slug` are `stable security definer` and call `current_role_is_paid()` which reads `auth.uid()`. Confirm in a test that `auth.uid()` resolves correctly **inside a SECURITY DEFINER function invoked via PostgREST `rpc()`** with the user's JWT (it does only because PostgREST sets the `request.jwt.claims` GUC and runs as the authenticated role before the definer swap — verify, don't assume, because a misconfigured `set search_path`/role can silently make `auth.uid()` return NULL → every caller treated as free, or worse, a definer-owner context treating someone as paid). **Add an explicit test: paid user gets paid projection, free user does not, anon gets teaser/null.**
- `list_dispatches` is granted to `authenticated` but NOT `anon`. A free *logged-in* user is `authenticated` and the function self-gates with `current_role_is_paid()` → returns empty. Good. But confirm the archive page handles "authenticated-but-empty" identically to "anon" (upsell), and that calling the RPC as anon returns a clean permission error the client tolerates, not a 500.

### B5. Ingest authentication will reject valid POSTs unless the HMAC body is byte-identical end-to-end
The plan verifies "HMAC-SHA256 over the **raw body** before JSON parse." This is correct and necessary — but it's fragile in a way that will cost a day of debugging if not nailed down now:
- Next.js Route Handlers must read `await req.text()` (the raw string) and HMAC **that exact byte sequence**, then `JSON.parse` it manually. If any middleware, body parser, or `req.json()` touches the body first, the bytes the server hashes differ from the bytes the Mac hashed → 401 on every legitimate run. The plan already excludes `api/ingest` from middleware (good) — make "read raw text, never `req.json()` before HMAC" an explicit code rule.
- The Mac signs `printf '%s' "$BODY"` where `$BODY=$(cat dispatch.json)`. Command substitution **strips trailing newlines**; `curl --data-binary @file` sends the file **with** its trailing newline. So the Mac may hash bytes that differ from what it POSTs. **Fix: sign the exact bytes you send** — either `--data-binary @"$DISPATCH"` AND `openssl ... < "$DISPATCH"` (both read the file directly, no `$(...)` round-trip), or POST `--data-binary "$BODY"`. Pin this; it's the classic HMAC footgun.
- Constant-time compare for the bearer too (the plan says so for HMAC; say it for the bearer).

---

## CONCERNS (will hurt mid-build)

### C1. Bilingual EN can silently never get generated for some fields — no enforcement
The determinism wall (numbers ZH/EN-neutral, prose translated) is sound. But "EN exists for every prose field" is asserted, never enforced. recon-01 §6 lists 8 prose fields needing EN; the ingest zod schema must **require** `{en, zh}` (both non-empty) on every prose field and reject (422) otherwise — else a `claude -p` translation pass that drops a field (truncated JSON, a refusal, a field renamed upstream) ships a row that renders blank EN with no alarm. Today's plan validates "the §5.2 shape" but doesn't state EN-non-empty. **Make the zod schema fail closed on any empty `_en`.** Also: `full_narrative` is legitimately null on non-Sunday/non-triggered days — encode "nullable as a whole, but if present both langs required" so the validator doesn't reject weekdays.

### C2. Field-name drift between the harness scripts and the ingest contract is unmanaged
recon-01 (ground truth from the actual scripts) and recon-05's contract already disagree:
- Plan/recon-05 use `etf`, `name_zh`; recon-01 uses `ticker`, `ticker_label_zh`; scripts emit keys under `"US.SPY"` with `this_week_return_pct` etc. Someone writes `assemble_dispatch.py` mapping script keys → contract keys, and there is **no shared schema** binding the two. recon-04 even invents `nameZh/nameEn`, `bucket`, `crossRead`, `holdingNote` (camelCase) that exist nowhere else.
- `dispersion_label` is `"高"|"中"|"低"` from the script (recon-01) but `{zh,en}` in the contract (recon-05) — a mapping step must translate the enum, and if it doesn't, you store a Chinese glyph where the UI expects an object.
- `compute_fast_monitor.py --json` output shape is **assumed** in recon-05 (`snapshot_reference`, `current_fast_values`, `deltas`, `live_layers_raw`) but recon-01 only documents `compute_composite_score.py`'s shape, not the fast monitor's. The plan's Phase E depends on a contract for a script whose actual `--json` keys were never reconned. **Before Phase E, dump `compute_fast_monitor.py --json` for real and pin its keys; don't let `assemble_dispatch.py` be the first place anyone discovers the real shape.**

### C3. `getUserAndRole()` (recon-04) bypasses the derived-role source of truth
recon-04's helper derives paid/free by reading a *single* `subscriptions` row's `status` (`maybeSingle()`). The whole billing design (recon-03/PLAN) insists role is `profiles.role`, recomputed by `reconcile_role` scanning ALL subs. Two role-derivation paths = drift. If a user has two sub rows (old canceled + new active), `maybeSingle()` throws or picks wrong. **Fix: every read path derives role from `profiles.role` ONLY** (the webhook-maintained truth). Make `getSession()` read `profiles.role`, never recompute from `subscriptions` in app code.

### C4. Stripe `current_period_end` source + the "subscription object not retrievable yet" race
- `invoice.paid` handler reads `current_period_end` "from the line period." On recent Stripe API versions `current_period_end` moved off the subscription top-level onto `items.data[].current_period_end`; the invoice's `lines.data[].period.end` is the reliable source. Pin the API version in the Stripe client init and read the field that version actually exposes — don't code to a field that 404s silently to `undefined` and stores NULL (then the account page shows "renews: never").
- `checkout.session.completed` may arrive before `customer.subscription.created`, or the sub may not be expandable on the session yet. The plan says "upsert sub if retrievable" — good — but ensure `reconcile_role` is also called on `subscription.created`/`invoice.paid` (it is), so the user flips to paid even if the checkout handler couldn't see the sub. The real risk: if NONE of the three handlers successfully resolves the uid (customer not yet linked, metadata missing), the user pays and never flips. **Mitigation: always set `subscription_data.metadata.supabase_user_id` AND `client_reference_id` (plan does), and add a reconcile fallback on `/account` load that, if the user has a `stripe_customer_id` but role=free, re-queries Stripe for active subs server-side.** Cheap insurance against a stuck paying customer.

### C5. No Stripe Customer ↔ user uniqueness guard; duplicate customers strand subs
If `checkout` creates a Stripe Customer every time `profiles.stripe_customer_id` is read as null (e.g. two fast clicks, or a failed write-back), you get two Stripe customers for one user; the webhook links the sub to whichever customer it resolves, and role logic can desync. **Fix: create the Customer once, write `stripe_customer_id` back transactionally, and on checkout reuse it; consider Stripe idempotency keys on Customer + Checkout Session creation.**

### C6. Mac single-point-of-failure is a real liability for a PAID daily product
The plan's honest position — "late, not lost; watchdog DMs on miss; site shows Delayed banner" — is fine for a free newsletter. For a $15/mo product the failure mode is: Mac asleep / OpenD down / FMP quota hit / `claude -p` refuses → no dispatch → paying users see a stale banner and churn, and YOU are the only pager. Concretely:
- OpenD must be running and logged in at 00:05 UTC; it silently logs out. There's no watchdog for "OpenD up," only for "dispatch landed."
- `claude -p` translation can fail/refuse/emit invalid JSON; the plan `die()`s — correct — but that means a translation hiccup = whole dispatch missing, not "ZH ships, EN retries." Consider: ingest the ZH-complete dispatch even if EN translation fails, mark `en_pending`, backfill EN. recon-01 Option C (server-side translate as stopgap) is the natural seam — keep it alive rather than making EN a hard gate on the whole product shipping.
- **This is acceptable for v1 IF you (a) accept the operational burden consciously and (b) write the "manual re-run" runbook now** (`bash run_sightlab_dispatch.sh` backfills). Just don't discover the burden in production. See Riskiest Assumption.

### C7. ISR / caching can serve a paid render to the next anon visitor
The dispatch page is per-role. If anyone adds `export const revalidate = N`, `unstable_cache`, `fetch(..., {next:{revalidate}})`, or a CDN cache header on `/dispatch/[date]`, a paid user's full-table render can be cached and replayed to an anon. The plan never states the cache posture. **Fix: dispatch/account/archive pages MUST be `dynamic = 'force-dynamic'` (or `revalidate = 0`) and carry `Cache-Control: private, no-store`. Marketing/paper pages may cache. Make this an explicit invariant + a Phase G check (curl as anon, assert no paid bytes, assert `no-store`).**

### C8. RSC payload leak vector beyond the network tab
"Bytes never serialized" holds only if the paid components never receive paid data on the free branch. The plan's `LockedRegion` taking zero props is exactly right. But verify the *whole subtree*: if any shared parent layout or a client component receives the full dispatch object as a prop (even for a count, a date, an "as of"), Next serializes it into the RSC/flight payload and it's in the HTML. **Audit: the free branch must construct ZERO objects containing `flows_section6`/`cycle_section7`. Phase C DONE should grep the served HTML + `__next_f` flight chunks for a known paid token (e.g. a ticker-specific `ad_score`), not just eyeball the network tab.**

### C9. Email confirmation flow vs. the `handle_new_user` trigger and checkout
The trigger creates `profiles` on `auth.users` insert. With email-confirmation ON, the user can hit `/pricing` → checkout before confirming; with it OFF, anyone can create accounts freely. Decide the setting (plan leaves it "as preferred") because it changes the funnel and the abuse surface. Also: `handle_new_user` inserts `email` (PLAN) but recon-03's version does NOT (only `id`) — and `profiles.email` can go stale vs `auth.users.email`. **Pick: store email on profiles (and keep it synced) or always join `auth.users`. Don't half-do it.**

### C10. `/paper` print/copy protections will break honest reading and don't stop the threat
`@media print { body { display:none } }` blanks the page on Cmd-P — but it also blanks it for a user who legitimately wants to read offline, and screenshot/`innerText` defeats all of it (the plan admits this). The real protection is **keeping proprietary thresholds/weights off the page**, which the plan correctly states. So the JS lock theater (disable copy/contextmenu/cut) buys almost nothing and adds a11y/UX cost. **Suggestion: keep `user-select:none` + the honest caveat, drop the aggressive `body{display:none}` print nuke (it punishes honest users), and put real effort into the content boundary instead.**

---

## SUGGESTIONS

- **S1. Add `schema_version` handling on ingest.** recon-05 has `schema_version: 1`; the plan's body doesn't mention validating it. Reject unknown versions (400) so a future harness change can't silently write garbage.
- **S2. Seed-data + RLS regression test as a committed test, not a manual Phase B step.** Encode "anon `from('dispatches').select('*')` returns 0 rows" and "free RPC response contains no paid keys" as automated tests in CI, not a one-time DevTools check — this is the product's core guarantee and it should fail the build if it regresses (the plan's Risk #4 even asks for exactly this).
- **S3. `published` boolean vs `status` enum mismatch.** PLAN uses `published boolean`; recon-03 uses `status dispatch_status enum ('draft','published')` + a check constraint + `slug`. Pick one. The enum+slug version is more extensible (draft previews, distinct slug from date) — but the plan dropped `slug` and uses `dispatch_date` as the slug. Decide whether you ever want a slug ≠ date; if not, the plan's simpler shape is fine — just make the migration internally consistent (the plan's `0001` and recon-03's migration are different files claiming to be the same table).
- **S4. Rate-limit `/api/ingest` and `waitlist` insert.** `waitlist_insert_anon with check (true)` lets anon insert unbounded rows (spam). Add a basic rate limit / captcha or at least a unique(email) (recon-03 has unique, PLAN's waitlist does NOT). Re-add the unique constraint.
- **S5. `generated_at` / freshness banner uses `dispatch_date` (a UTC calendar date) for staleness, but generation happens at 00:05 UTC.** Define "stale" precisely: latest `dispatch_date < today_UTC`. Edge case: a viewer in UTC+8 at local morning is already on "tomorrow" UTC-wise for a few hours — make sure the banner logic compares against UTC `today`, computed server-side, not the visitor's clock.
- **S6. Annual price "10% off" is baked into `unit_amount=16200`.** $15×12=$180; 10% off = $162. Correct. But there's no coupon, so a future price change means editing two amounts and risking drift. Fine for v1; just document that the discount is implicit, not enforced by Stripe.
- **S7. Pin the Stripe API version** in the SDK init (`apiVersion`) so field locations (B-series, C4) don't move under you on a Stripe upgrade.
- **S8. Telegram teaser is the free slice — confirm it carries NO `composite_score`** (same leak as B3). The teaser channel is a promo surface; treat its content under the same free-boundary rule as the site.

---

## THE SINGLE RISKIEST ASSUMPTION

**That a one-Mac, launchd-triggered harness is a reliable enough origin for a PAID daily product.**

Every other risk has a clean technical fix inside the repo. This one is structural and outside it. The plan's mitigation ("late, not lost; watchdog DMs me; Delayed banner") quietly converts a product-uptime problem into a *personal on-call* problem: the dispatch depends on YOUR Mac being awake, OpenD logged in, FMP quota intact, the network up, and `claude -p` cooperating, every single UTC midnight, forever — and when any link breaks, the only consequence path is a Telegram DM to you and a "Delayed" banner shown to people who are paying $15/mo for freshness. For a free newsletter that's charming; for a subscription it's the thing that generates refund requests and churn, and it doesn't scale past you.

You don't have to solve it for v1 — but you must **accept it consciously and bound it**: (1) write the manual-rerun runbook before launch, (2) add an OpenD-up / data-fresh watchdog (not just dispatch-landed), (3) decide that a translation failure ships ZH-only rather than nothing (recon-01 Option C seam), and (4) set a refund/SLA expectation in the pricing copy ("dispatches target 00:00 UTC; occasional delays happen") so a late day is a known property, not a broken promise. If SightLab gets real traction, moving the harness off the Mac onto a always-on runner (a small VM with OpenD, or decoupling §7's FMP path which needs no OpenD) is the first scaling investment — design `assemble_dispatch.py` to be host-agnostic now so that migration is a deploy, not a rewrite.
