# Contributing to SightLab

SightLab is an open research lab. Contributions are welcome — bug fixes, UI and
accessibility work, tests, translations, and (especially) corrections and challenges to the
methodology. This file covers how to propose a change, the quality gates your change must
pass, and the one rule that is never negotiable.

## 🔒 The privacy rule (read this first)

**Never commit holdings or personal data.** SightLab's dispatch is strictly market-wide: §6
fund flows and §7 cycle positioning across sectors and the broad market. It must never carry,
log, render, or commit:

- individual portfolio positions, holdings, or `holding_note` / 「对持仓的话」 fields,
- portfolio-action or "what to do with your position" content,
- user-specific ticker buckets, or any personal/account data.

This is enforced in code and tests, not just policy:

- `src/lib/ingest/schema.ts` rejects any ingest payload containing a `holding` / `portfolio`
  / `持仓` key (deep scan, fail-closed → 422).
- `src/lib/email/privacyGuard.ts` throws before an email renders if a holdings field appears.
- `src/lib/ingest/schema.test.ts` and `supabase/tests/privacy.test.mjs` assert both, and the
  payload contract surface is grepped for holdings field names.

A change that weakens any of these — or that adds a holdings field anywhere in the dispatch
payload — will be rejected. If you genuinely need to handle personal data for some _separate,
parked_ feature, raise an issue first; it does not belong in the dispatch path.

Also: never commit secrets. Real values go in `.env.local` (gitignored); only the blank
template `.env.example` is tracked.

## How to propose a change

1. **Open an issue first** for anything non-trivial — a bug, a methodology correction, a
   feature — so the approach can be discussed before you build it.
2. **Fork and branch** off the default branch. Keep the change focused: one logical change per
   pull request. Don't bundle unrelated refactors or reformatting.
3. **Match the existing style.** Surgical edits only — change what the task needs, follow the
   surrounding conventions, and let Prettier handle formatting (don't hand-reformat).
4. **Write or update tests** for behavior you change. The privacy guard, the i18n fallback,
   and the ingest schema all have tests; new contract-level behavior should get one too.
5. **Open a PR** describing _what_ changed and _why_, and reference the issue. CI runs lint,
   format check, typecheck, build, and tests on every PR.

## Quality gates

Run these locally before opening a PR — they are exactly what CI enforces:

```bash
npm run lint          # ESLint (eslint-config-next + @typescript-eslint)
npm run format:check  # Prettier — run `npm run format` to auto-fix
npm run typecheck     # tsc --noEmit
npm test              # vitest — pure-function + schema tests, no live DB
npm run test:paywall  # node --test supabase/tests/ — read-path + privacy guards
npm run build         # next build
```

All six must pass. The unit tests run with **no live database** — they are pure-function and
schema tests, so `npm test` works on any checkout. Tests that need a live Supabase project
live under `supabase/tests/` and skip cleanly when the env vars are absent.

## Methodology contributions

The methodology paper (`src/components/paper/PaperDraft.tsx`, served at `/paper`) is a working
draft. Corrections to the reasoning are genuinely wanted. Two constraints:

- **No proprietary numbers.** The paper explains the _method and intuition_. The exact
  thresholds, weights, and layer formulas stay off the page (and out of the repo's public
  surface) — that boundary is deliberate.
- **No advice.** Keep it descriptive market-structure language. SightLab is research, not
  investment advice, and the paper must read that way.

## License

By contributing, you agree your contributions are licensed under the project's
[GNU AGPL-3.0](LICENSE).
