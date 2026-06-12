# SightLab Mac Producer — RUNBOOK

Operating + recovery guide for the daily dispatch pipeline (PLAN §7, §14-M1/M2).
These scripts are **version-controlled here** but **run from a deployed copy** in a
TCC-free data dir — never `~/Documents` (launchd cannot read it under macOS TCC).

---

## What runs, when

| Agent | Schedule | Does |
|---|---|---|
| `com.sightlab.dispatch` | 00:05 UTC (08:05 KL, UTC+8) | `run_sightlab_dispatch.sh`: scripts → assemble → POST to `/api/ingest` |
| `com.sightlab.watchdog` | ~01:30 UTC (09:30 KL) | `sightlab_watchdog.sh`: DM if dispatch missing **or** OpenD down |

The producer fires 5 min before daily-news (08:10 KL) to avoid OpenD/FMP collision.
launchd reruns a missed job **on wake** → a sleeping Mac means a **late**, not lost,
dispatch. A late day is a known property, not a broken promise (PLAN §14-M4).

---

## One-time deploy

```bash
# 1. Pick a TCC-free data dir and copy the two runtime files there.
export SIGHTLAB_DATA_DIR="$HOME/news-cron/sightlab"     # example — NOT ~/Documents
mkdir -p "$SIGHTLAB_DATA_DIR/logs"
cp scripts/mac/run_sightlab_dispatch.sh scripts/mac/assemble_dispatch.py \
   scripts/mac/sightlab_watchdog.sh "$SIGHTLAB_DATA_DIR/"
chmod +x "$SIGHTLAB_DATA_DIR/"*.sh "$SIGHTLAB_DATA_DIR/assemble_dispatch.py"

# 2. Create the env file (chmod 600 — NEVER the Supabase service-role key here).
mkdir -p "$HOME/.config/sightlab"
cat > "$HOME/.config/sightlab/.env" <<'EOF'
SIGHTLAB_DATA_DIR=/Users/<you>/news-cron/sightlab
SIGHTLAB_SKILLS_DIR=/Users/<you>/.claude/skills
SIGHTLAB_INGEST_URL=https://sightlab.fysight.biz/api/ingest
SIGHTLAB_INGEST_SECRET=<MUST equal the Vercel SIGHTLAB_INGEST_SECRET>
SIGHTLAB_INGEST_HMAC_KEY=<MUST equal the Vercel SIGHTLAB_INGEST_HMAC_KEY>
# Failure alerts (reused from the existing harness — DM, not content):
TELEGRAM_API_KEY=<bot token>
TELEGRAM_CHAT_ID=<your DM chat id>
# Watchdog dispatch-landed check (public, safe to keep on the Mac):
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
# Optional — use ABSOLUTE paths under launchd (its PATH is minimal; the plists
# inject /opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin, but an absolute
# CLAUDE_BIN/PYTHON_BIN is the robust choice if yours lives elsewhere, e.g.
# CLAUDE_BIN=/Users/<you>/.local/bin/claude):
# CLAUDE_BIN=claude  PYTHON_BIN=python3  SIGHTLAB_NO_TRANSLATE=1
# SIGHTLAB_TRANSLATE_MODEL=claude-haiku-4-5-20251001
# SIGHTLAB_WATCHDOG_GRACE_MIN=15
EOF
chmod 600 "$HOME/.config/sightlab/.env"
```

### Install BOTH launchd agents (producer + watchdog)

Edit each plist's `__SIGHTLAB_DATA_DIR__` placeholder (every occurrence — program
path AND log paths derive from the same placeholder) to your **absolute** data dir
first, then bootstrap:

```bash
# Producer: com.sightlab.dispatch (00:05 UTC daily)
cp scripts/mac/com.sightlab.dispatch.plist "$HOME/Library/LaunchAgents/"
# (edit the copy: __SIGHTLAB_DATA_DIR__ → e.g. /Users/<you>/news-cron/sightlab)
launchctl bootout   "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.sightlab.dispatch.plist" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.sightlab.dispatch.plist"

# Watchdog: com.sightlab.watchdog (~01:30 UTC daily) — the dead-man's-switch.
# Without it, a job that never fires alarms NOBODY. Install it.
cp scripts/mac/com.sightlab.watchdog.plist "$HOME/Library/LaunchAgents/"
# (edit the copy: __SIGHTLAB_DATA_DIR__ → same dir as above)
launchctl bootout   "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.sightlab.watchdog.plist" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.sightlab.watchdog.plist"

# Verify both are loaded:
launchctl print "gui/$(id -u)/com.sightlab.dispatch" | head -5
launchctl print "gui/$(id -u)/com.sightlab.watchdog" | head -5

# Smoke-test the producer once without waiting for the schedule:
launchctl kickstart "gui/$(id -u)/com.sightlab.dispatch"
```

`SIGHTLAB_INGEST_SECRET` and `SIGHTLAB_INGEST_HMAC_KEY` **must be byte-identical** to
the Vercel values. The service-role key lives **only** on Vercel — never on the Mac.

---

## Manual rerun / backfill a missed day (PLAN §14-M1)

The ingest is an idempotent **upsert** keyed on `dispatch_date`, so re-running the
same day **overwrites** the row (no duplicate) and clears the site's "Delayed"
banner. To backfill or force a re-run right now:

```bash
cd "$SIGHTLAB_DATA_DIR"
bash run_sightlab_dispatch.sh
```

It runs today's (UTC) date. To re-run after fixing a translation outage so EN
backfills, just run it again — `en_pending` flips back to false on the re-POST.

To skip translation entirely (offline / `claude` unavailable) and ship ZH-only with
`en_pending=true`:

```bash
SIGHTLAB_NO_TRANSLATE=1 bash run_sightlab_dispatch.sh
```

---

## Recovery by failure mode

| Symptom (DM text) | Cause | Fix |
|---|---|---|
| `query_weekly_flows.py failed (OpenD logged out?)` | OpenD gateway down / logged out | Open & log into OpenD, then `bash run_sightlab_dispatch.sh` |
| `ingest returned HTTP 401` | bearer or HMAC mismatch (Mac vs Vercel) | Confirm `SIGHTLAB_INGEST_SECRET` + `SIGHTLAB_INGEST_HMAC_KEY` match Vercel exactly; rerun |
| `ingest returned HTTP 401 ... date_out_of_range` | Mac clock skew vs UTC | Fix system time; rerun |
| `ingest returned HTTP 422 validation_failed` | a script changed its output shape | Check `logs/<date>.log`; fix the mapping in `assemble_dispatch.py`; rerun |
| `ingest returned HTTP 422 ... PRIVACY VIOLATION` | a holdings-shaped key reached the body | A producer leaked holdings — **do not bypass**. Remove the source; the guard is correct (PLAN §15.4) |
| `assemble_dispatch.py failed` | bad/empty upstream JSON | Inspect `work/<date>/{flows,dispersion,fast_monitor}.json`; rerun the offending script `--json` by hand |
| Watchdog: `OpenD 当前不可用` | gateway down (tomorrow's run will fail) | Log into OpenD before the next 00:05 UTC fire |
| Watchdog: `dispatch 未落地` but producer said OK | push dropped / DB write lost | `bash run_sightlab_dispatch.sh` to re-POST |
| Watchdog: `无法探测 dispatch 是否落地` | network/Supabase unreachable from the Mac (NOT missing content) | Check connectivity / Supabase status; the dispatch itself may be fine |
| OK line ends `(translate SKIPPED: CLAUDE_BIN not found …)` | `claude` not resolvable on the job's PATH | Set an **absolute** `CLAUDE_BIN` in `~/.config/sightlab/.env`; rerun to backfill EN (`en_pending` flips false) |

Logs: `$SIGHTLAB_DATA_DIR/logs/<date>.log` (per-run), `launchd-sightlab.{out,err}` +
`launchd-watchdog.{out,err}` (launchd, both under `$SIGHTLAB_DATA_DIR/logs/`),
`sightlab-watchdog.log` (watchdog).

---

## Privacy invariant (do not weaken — PLAN §15.4 LOCKED)

The dispatch carries **only** market-wide §6 (fund flows) + §7 (cycle / dispersion /
Weinstein stage + market-structure judgment). It **never** carries holdings:
`assemble_dispatch.py` reads no §8/holdings/portfolio source and re-asserts the body
is holdings-free before writing; the ingest endpoint rejects (422) any body with a
key matching `/holding|portfolio|持仓/i`. If you hit a `PRIVACY VIOLATION`, the guard
is doing its job — fix the producer, never the guard.
