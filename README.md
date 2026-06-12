# SightLab

**An open research lab on market structure.** SightLab publishes one deterministic,
market-wide read each day: where money is flowing across sectors, and where the broad
market sits in its cycle. It is free to read, open-source under **AGPL-3.0**, and built
to be a _confirmer of the regime already in place_ — never a predictor of the next one.

> SightLab is research, not investment advice. The cycle read is a confirmer, not a
> predictor. It is strongest mid-trend and deliberately blind to exact tops and bottoms.

## What it publishes

Every dispatch carries two complementary, **market-wide** lenses:

- **§6 — Weekly Fund Flows.** An accumulation / distribution read across sectors: is money
  confirming each sector's price move, or fading it? Rotation between sectors is the signal
  that survives noise.
- **§7 — Market Cycle Positioning.** A Weinstein-stage read anchored to the 30-week simple
  moving average, plus a sector-dispersion measure of how broad (or fragile) the leadership
  is. The judgment is market-structure commentary — _"tech in a confirmed Stage 2 uptrend;
  energy distributing"_ — never a comment on any individual position.

The numbers are computed deterministically in an upstream harness; only the surrounding
prose is bilingual (EN / 中文). The methodology is written up in the paper.

## 🔒 Privacy boundary (non-negotiable)

The dispatch — on the site, in email, on Telegram, on X — carries **only market-wide §6/§7
data**. It **never** carries holdings, portfolio actions, or any personal position data. This
is enforced in code: the ingest schema rejects any payload containing a `holding` /
`portfolio` / `持仓` key, and the email renderer throws before sending if a holdings field
ever appears. See `src/lib/ingest/schema.ts` and `src/lib/email/privacyGuard.ts`, with the
guard tests in `src/lib/ingest/schema.test.ts`.

## Methodology paper

The method — the intuition behind §6 accumulation/distribution, §7 Weinstein staging + the
30-week SMA + sector dispersion, and the "confirmer, not predictor" framing with its
limitations — is published at **`/paper`** (rendered from
`src/components/paper/PaperDraft.tsx`). It is open by design: the _ideas_ are public; the
exact proprietary thresholds and weights are not on the page.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth, RLS +
`SECURITY DEFINER` RPCs) · `next-intl` (cookie locale, no `/[locale]` segment) · Resend (daily
email digest). Content is fully public; a free account exists only for distribution opt-ins
(Telegram invite, daily email). The Stripe billing + role-gated paywall code remains in the
repo as **parked** — reserved for a possible future tier, not wired to gate content.

## Local development

```bash
# 1. install
npm install

# 2. configure env (copy the template, fill what you need)
cp .env.example .env.local
# For just running the UI you can leave Supabase/Stripe blank — the build and the
# unit tests need no live services. To read/seed real dispatches you'll need a
# Supabase project (see docs/PLAN.md §13).

# 3. run the dev server
npm run dev          # http://localhost:3000

# quality gates (the same ones CI runs)
npm run lint         # ESLint
npm run format       # Prettier (write)   /  npm run format:check
npm run typecheck    # tsc --noEmit
npm test             # vitest (pure-function + schema tests, no DB)
npm run build        # production build
```

Full provisioning — Supabase project + migrations, Resend sender, Telegram channel,
Vercel + Cloudflare DNS — is documented step-by-step in **[`docs/PLAN.md` §13](docs/PLAN.md)**.

## Contributing

Contributions are welcome — corrections to the methodology, UI work, tests, translations.
Start with **[CONTRIBUTING.md](CONTRIBUTING.md)**: how to propose a change, run the quality
gates, and the one hard rule (never commit holdings or personal data).

## License

[GNU AGPL-3.0](LICENSE). Anyone running a modified copy — including as a network service —
must make their source changes available, so improvements flow back to the lab.
