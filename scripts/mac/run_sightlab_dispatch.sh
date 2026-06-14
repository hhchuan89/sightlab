#!/bin/bash
# run_sightlab_dispatch.sh — daily SightLab producer (PLAN §7.1, §14-B5/C1/M).
#
# SCHEDULE (launchd fires this DAILY at 00:05 UTC = 08:05 KL, same calendar day;
# the runner itself decides what to do based on the UTC weekday):
#   • Tue–Sat UTC  → DAILY report. 00:05 UTC reports the PRIOR US-session close
#                    (Mon–Fri US close lands the evening before in UTC terms).
#   • Sun UTC      → WEEKLY review (--weekly): kind=weekly + full_narrative.
#   • Mon UTC      → REST day: no US close to report (Sun = no US session) → the
#                    runner no-ops immediately (cheap exit 0) before any script.
# So launchd stays a plain daily timer; the day→session mapping lives here.
#
# Pipeline (non-rest days): run the three §6/§7 market scripts → assemble_dispatch.py
# → POST the EXACT file bytes to $SIGHTLAB_INGEST_URL with a bearer + an HMAC-SHA256
# over those same bytes. Any failure die()s to a Telegram DM (no partial POST).
#
# 🔒 PRIVACY (PLAN §15.4): reads ONLY market data — weekly flows, sector
# dispersion, cycle composite. NO §8 / holdings / portfolio / positions script is
# run. assemble_dispatch.py also re-asserts the body is holdings-free.
#
# HOST-AGNOSTIC: every path + id is an ENV var (no hardcoded chat ids / home
# paths). It is version-controlled in the repo but DEPLOYED to $SIGHTLAB_DATA_DIR
# (a TCC-free data dir, NEVER ~/Documents — launchd cannot read Documents).
#
# REQUIRED ENV (from $CONFIG_DIR/.env, chmod 600):
#   SIGHTLAB_DATA_DIR        TCC-free working dir (e.g. ~/news-cron/sightlab)
#   SIGHTLAB_SKILLS_DIR      base of the quant-harness skills (e.g. ~/.claude/skills)
#   SIGHTLAB_INGEST_URL      https://<host>/api/ingest
#   SIGHTLAB_INGEST_SECRET   bearer (MUST equal the Vercel value)
#   SIGHTLAB_INGEST_HMAC_KEY HMAC key (MUST equal the Vercel value)
#   TELEGRAM_API_KEY         bot token — for FAILURE ALERTS ONLY (not content)
#   TELEGRAM_CHAT_ID         the DM chat id — failure alerts
# OPTIONAL:
#   CONFIG_DIR               dir holding .env (default: $HOME/.config/sightlab)
#   PYTHON_BIN               python3 to use (default: python3)
#   CLAUDE_BIN               claude CLI for ZH→EN (default: claude)
#   SIGHTLAB_NO_TRANSLATE=1  skip translation (ship en_pending=true)
set -uo pipefail

CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/sightlab}"
# Load secrets/paths from the env file if present (does not clobber already-set env).
if [ -f "$CONFIG_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$CONFIG_DIR/.env"
  set +a
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
export CLAUDE_BIN

# --- die(): DM the failure to the user, then exit non-zero. ------------------
die() {
  local msg="$1"
  local stamp
  stamp="$(date '+%F %T %Z')"
  echo "run_sightlab_dispatch: FAIL @ $stamp — $msg" >&2
  if [ -n "${TELEGRAM_API_KEY:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -F "chat_id=${TELEGRAM_CHAT_ID}" \
      --form-string "text=⚠️ SightLab dispatch 失败 @ ${stamp}：${msg}。检查 ${SIGHTLAB_DATA_DIR:-?}/logs 与 OpenD/FMP。手动补跑：bash run_sightlab_dispatch.sh（幂等 upsert，清掉 Delayed 横幅）。" \
      "https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage" >/dev/null 2>&1 || true
  fi
  exit 1
}

# --- required env -------------------------------------------------------------
# Check via die() (not ${VAR:?}) so a missing var still DMs the user instead of
# aborting silently under `set -u`.
[ -n "${SIGHTLAB_DATA_DIR:-}" ] || die "SIGHTLAB_DATA_DIR is not set"
[ -n "${SIGHTLAB_SKILLS_DIR:-}" ] || die "SIGHTLAB_SKILLS_DIR is not set"
[ -n "${SIGHTLAB_INGEST_URL:-}" ] || die "SIGHTLAB_INGEST_URL is not set"
[ -n "${SIGHTLAB_INGEST_SECRET:-}" ] || die "SIGHTLAB_INGEST_SECRET is not set"
[ -n "${SIGHTLAB_INGEST_HMAC_KEY:-}" ] || die "SIGHTLAB_INGEST_HMAC_KEY is not set"

# Where this script + assemble_dispatch.py live after deploy (same dir).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSEMBLE="$SCRIPT_DIR/assemble_dispatch.py"
[ -f "$ASSEMBLE" ] || die "assemble_dispatch.py not found next to runner ($ASSEMBLE)"

FLOWS_PY="$SIGHTLAB_SKILLS_DIR/moomoo/scripts/query_weekly_flows.py"
DISP_PY="$SIGHTLAB_SKILLS_DIR/cycle/scripts/query_sector_dispersion.py"
FAST_PY="$SIGHTLAB_SKILLS_DIR/cycle/scripts/compute_fast_monitor.py"
for f in "$FLOWS_PY" "$DISP_PY" "$FAST_PY"; do
  [ -f "$f" ] || die "harness script missing: $f"
done

DATE_UTC="$(date -u +%F)"

# Day-of-week routing (UTC; 1=Mon … 7=Sun). See the SCHEDULE comment in the header.
DOW="$(date -u +%u)"
WEEKLY_FLAG=()
if [ "$DOW" = "1" ]; then
  # Monday UTC: no prior US session to report → rest day. Cheap no-op BEFORE any
  # market script runs. launchd still fires daily; the runner just exits clean.
  echo "run_sightlab_dispatch: rest day (Mon UTC) — no dispatch ($DATE_UTC)"
  exit 0
elif [ "$DOW" = "7" ]; then
  # Sunday UTC: weekly review. Same-day date; assemble emits kind=weekly + full_narrative.
  WEEKLY_FLAG=(--weekly)
fi
# else (Tue–Sat): daily, exactly as before.

WORK="$SIGHTLAB_DATA_DIR/work/$DATE_UTC"
LOGDIR="$SIGHTLAB_DATA_DIR/logs"
mkdir -p "$WORK" "$LOGDIR" || die "cannot create work/log dirs under $SIGHTLAB_DATA_DIR"

FLOWS_JSON="$WORK/flows.json"
DISP_JSON="$WORK/dispersion.json"
FAST_JSON="$WORK/fast_monitor.json"
DISPATCH_JSON="$WORK/dispatch.json"

# --- 1. run the three market scripts (stdout → file; assemble tolerates the ---
#        moomoo OpenD connect/disconnect log noise some emit on stdout). --------
"$PYTHON_BIN" "$FLOWS_PY" --json > "$FLOWS_JSON" 2>>"$LOGDIR/$DATE_UTC.log" \
  || die "query_weekly_flows.py failed (OpenD logged out? FMP down?)"
"$PYTHON_BIN" "$DISP_PY" --json > "$DISP_JSON" 2>>"$LOGDIR/$DATE_UTC.log" \
  || die "query_sector_dispersion.py failed"
"$PYTHON_BIN" "$FAST_PY" --json > "$FAST_JSON" 2>>"$LOGDIR/$DATE_UTC.log" \
  || die "compute_fast_monitor.py failed"

# --- 2. assemble (maps real keys → §5.2 contract; ZH→EN; EN-soft-fail). -------
TRANSLATE_FLAG=()
[ "${SIGHTLAB_NO_TRANSLATE:-0}" = "1" ] && TRANSLATE_FLAG=(--no-translate)

# launchd runs with a minimal PATH, so a bare `claude` default may not resolve.
# Translation is OPTIONAL (EN-soft-fail ships en_pending=true), so do NOT crash
# the whole dispatch over a missing CLI: WARN loudly, force --no-translate, and
# carry the fact into the final OK line so it can never soft-fail invisibly.
TRANSLATE_NOTE=""
if [ "${SIGHTLAB_NO_TRANSLATE:-0}" != "1" ] && ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
  echo "run_sightlab_dispatch: WARN — CLAUDE_BIN '$CLAUDE_BIN' not found on PATH ($PATH); forcing --no-translate (ZH ships with en_pending=true). Set CLAUDE_BIN to an ABSOLUTE path in $CONFIG_DIR/.env." \
    | tee -a "$LOGDIR/$DATE_UTC.log" >&2
  TRANSLATE_FLAG=(--no-translate)
  TRANSLATE_NOTE=" (translate SKIPPED: CLAUDE_BIN not found — en_pending=true)"
fi

# NOTE: ${arr[@]+"${arr[@]}"} is the bash-3.2-safe expansion — a bare
# "${TRANSLATE_FLAG[@]}" on an EMPTY array is fatal under `set -u` in
# /bin/bash 3.2 (fixed only in bash 4.4), and that crash bypasses die().
"$PYTHON_BIN" "$ASSEMBLE" \
  --flows "$FLOWS_JSON" --dispersion "$DISP_JSON" --fast-monitor "$FAST_JSON" \
  --out "$DISPATCH_JSON" --date "$DATE_UTC" \
  ${WEEKLY_FLAG[@]+"${WEEKLY_FLAG[@]}"} ${TRANSLATE_FLAG[@]+"${TRANSLATE_FLAG[@]}"} \
  2>>"$LOGDIR/$DATE_UTC.log" \
  || die "assemble_dispatch.py failed (see $LOGDIR/$DATE_UTC.log)"
[ -s "$DISPATCH_JSON" ] || die "assemble produced an empty dispatch.json"

# --- 3. POST the EXACT bytes. Sign the FILE directly + send the FILE directly --
#        (PLAN §14-B5: openssl < file AND curl --data-binary @file; NO $(cat) —
#        a $(cat) round-trip strips the trailing newline → HMAC mismatch → 401). -
SIG="$(openssl dgst -sha256 -hmac "$SIGHTLAB_INGEST_HMAC_KEY" < "$DISPATCH_JSON" | awk '{print $NF}')"
[ -n "$SIG" ] || die "HMAC computation produced no signature"

HTTP_CODE="$(curl -s -o "$WORK/ingest_response.json" -w '%{http_code}' \
  -X POST "$SIGHTLAB_INGEST_URL" \
  -H "Authorization: Bearer ${SIGHTLAB_INGEST_SECRET}" \
  -H "x-sightlab-signature: ${SIG}" \
  -H "x-sightlab-date: ${DATE_UTC}" \
  -H "Content-Type: application/json" \
  --data-binary @"$DISPATCH_JSON")" \
  || die "curl to $SIGHTLAB_INGEST_URL failed (network?)"

if [ "$HTTP_CODE" != "200" ]; then
  die "ingest returned HTTP $HTTP_CODE: $(head -c 400 "$WORK/ingest_response.json" 2>/dev/null)"
fi

echo "run_sightlab_dispatch: OK $DATE_UTC → ingest 200${TRANSLATE_NOTE}" | tee -a "$LOGDIR/$DATE_UTC.log"

# --- 4. Post a summary card to the Telegram channel (BEST-EFFORT). ------------
#        The dispatch is already published to the site; a Telegram failure must
#        NOT fail the run. Only runs if SIGHTLAB_TELEGRAM_CHANNEL_ID is set, so a
#        deploy without the channel id simply skips this step.
POST_TG="$SCRIPT_DIR/post_telegram.py"
if [ -n "${SIGHTLAB_TELEGRAM_CHANNEL_ID:-}" ] && [ -f "$POST_TG" ]; then
  if "$PYTHON_BIN" "$POST_TG" "$DISPATCH_JSON" >>"$LOGDIR/$DATE_UTC.log" 2>&1; then
    echo "run_sightlab_dispatch: telegram channel post OK" | tee -a "$LOGDIR/$DATE_UTC.log"
  else
    echo "run_sightlab_dispatch: WARN telegram channel post FAILED (publish still OK)" \
      | tee -a "$LOGDIR/$DATE_UTC.log" >&2
    if [ -n "${TELEGRAM_API_KEY:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
      curl -s -F "chat_id=${TELEGRAM_CHAT_ID}" \
        --form-string "text=⚠️ SightLab ${DATE_UTC}：站点已发布，但频道自动发帖失败。查 ${SIGHTLAB_DATA_DIR}/logs/${DATE_UTC}.log。" \
        "https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage" >/dev/null 2>&1 || true
    fi
  fi
fi

exit 0
