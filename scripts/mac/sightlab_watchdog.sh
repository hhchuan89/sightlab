#!/bin/bash
# sightlab_watchdog.sh — dead-man's-switch for the SightLab dispatch (PLAN §14-M2).
#
# The dispatch is produced by run_sightlab_dispatch.sh (launchd 00:05 UTC). That
# job die()s to a DM on its OWN failures, but a SILENT miss is the worst case (the
# Mac was asleep and launchd hasn't caught up, the job never fired, or the push
# silently dropped). This INDEPENDENT watchdog runs later (its own launchd agent,
# ~01:30 UTC / ~09:30 KL) and DMs if EITHER:
#   (a) today's dispatch did not land at the ingest host, OR
#   (b) the data gateway (OpenD) is down at run time — so even a "ran fine" day is
#       flagged when the upstream that feeds tomorrow's run is broken (§14-M2:
#       "OpenD-up / data-fresh, not just dispatch-landed").
#
# HOST-AGNOSTIC: all paths/ids via ENV. TCC-free: touches only $SIGHTLAB_DATA_DIR
# + $CONFIG_DIR/.env, never ~/Documents.
#
# FALSE-ALARM HARDENING:
#   • Retry: the landed-check polls up to 3 times, ~60 s apart, each poll with
#     curl --retry/--max-time — one transient network/Supabase blip never alarms.
#   • Wake-catchup grace: when the Mac slept through BOTH fire times, launchd
#     fires producer + watchdog together on wake with no ordering guarantee, and
#     the producer takes minutes (3 harness scripts + translation + POST). If the
#     producer's per-day log is HOT (modified within the grace window), the
#     watchdog keeps polling until a deadline well past the retries instead of
#     alarming a run that is mid-flight.
#   • The alert distinguishes "probe unreachable" from "latest is not today".
#
# REQUIRED ENV (from $CONFIG_DIR/.env):
#   SIGHTLAB_DATA_DIR, SIGHTLAB_SKILLS_DIR, NEXT_PUBLIC_SITE_URL (or
#   SIGHTLAB_SITE_URL), TELEGRAM_API_KEY, TELEGRAM_CHAT_ID
# OPTIONAL: CONFIG_DIR (default $HOME/.config/sightlab), PYTHON_BIN (default python3),
#   SIGHTLAB_WATCHDOG_GRACE_MIN (extra minutes to wait while the producer's
#   wake-catchup run is in flight; default 15)
set -uo pipefail

CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/sightlab}"
if [ -f "$CONFIG_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$CONFIG_DIR/.env"
  set +a
fi
PYTHON_BIN="${PYTHON_BIN:-python3}"
SITE_URL="${SIGHTLAB_SITE_URL:-${NEXT_PUBLIC_SITE_URL:-}}"

LOG="${SIGHTLAB_DATA_DIR:-$HOME}/logs/sightlab-watchdog.log"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
TS="$(date '+%F %T %Z')"
D_UTC="$(date -u +%F)"

# Monday UTC (date -u +%u == 1) is the producer's REST day — no dispatch is
# expected, so do NOT alarm on a missing one. Sunday's WEEKLY run still carries
# today's date, so the landed-check below works unchanged on Sun.
if [ "$(date -u +%u)" = "1" ]; then
  echo "$TS OK Monday UTC rest day — no dispatch expected, skipping checks" >>"$LOG"
  exit 0
fi

alerts=()

# --- (a) did today's dispatch land? Query the PUBLIC read RPC via PostgREST. ---
# We use the public Supabase RPC (get_latest_public) — same path the site reads.
# Needs NEXT_PUBLIC_SUPABASE_URL + ANON key (public, safe). If those are unset we
# fall back to fetching the site's /dispatch page and checking for today's date.

# probe_latest: echo the published-latest probe body; EMPTY output = unreachable.
probe_latest() {
  if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
    curl -s --retry 2 --max-time 30 -X POST \
      "${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1/rpc/get_latest_public" \
      -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" -d '{}' 2>/dev/null
  else
    curl -s --retry 2 --max-time 30 "${SITE_URL%/}/dispatch" 2>/dev/null
  fi
}

# producer_active: true if the producer's per-day log was modified within the
# grace window — i.e. the wake-catchup run is (very likely) mid-flight.
GRACE_MIN="${SIGHTLAB_WATCHDOG_GRACE_MIN:-15}"
producer_active() {
  local f="${SIGHTLAB_DATA_DIR:-}/logs/$D_UTC.log"
  [ -n "${SIGHTLAB_DATA_DIR:-}" ] && [ -f "$f" ] || return 1
  local now mtime
  now="$(date +%s)"
  mtime="$(stat -f %m "$f" 2>/dev/null || echo 0)"
  [ $((now - mtime)) -lt $((GRACE_MIN * 60)) ]
}

if [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ] || [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
  if [ -z "$SITE_URL" ]; then
    alerts+=("无法验证 dispatch 落地:未设置 \$NEXT_PUBLIC_SUPABASE_URL/\$NEXT_PUBLIC_SUPABASE_ANON_KEY 或 \$SIGHTLAB_SITE_URL。")
    NO_PROBE=1
  fi
fi

if [ -z "${NO_PROBE:-}" ]; then
  BASE_ATTEMPTS=3   # transient-blip retries, ~60 s apart
  DEADLINE=$(( $(date +%s) + GRACE_MIN * 60 ))   # hard stop for the grace wait
  landed=""
  unreachable=""
  attempt=1
  while :; do
    OUT="$(probe_latest)"
    if [ -z "$OUT" ]; then
      unreachable=1
    else
      unreachable=""
      if printf '%s' "$OUT" | grep -q "$D_UTC"; then
        landed=1
        break
      fi
    fi
    if [ "$attempt" -lt "$BASE_ATTEMPTS" ]; then
      : # still within the base retry budget
    elif producer_active && [ "$(date +%s)" -lt "$DEADLINE" ]; then
      : # wake-catchup grace: producer log is hot — keep waiting, don't alarm yet
    else
      break
    fi
    echo "$(date '+%F %T %Z') attempt $attempt: not landed (unreachable=${unreachable:-0}); retry in 60s" >>"$LOG"
    sleep 60
    attempt=$((attempt + 1))
  done

  if [ -z "$landed" ]; then
    if [ -n "$unreachable" ]; then
      alerts+=("无法探测 dispatch 是否落地:连续 ${attempt} 次查询失败(\$NEXT_PUBLIC_SUPABASE_URL RPC / \$SIGHTLAB_SITE_URL 网络不可达,非内容缺失)。")
    else
      alerts+=("今日($D_UTC)的 dispatch 未落地(已探测 ${attempt} 次,最新一期非今天)。")
    fi
  fi
fi

# --- (b) is the data gateway (OpenD) up right now? --------------------------
# A shared check ships with the moomoo skill; if present, run it. A non-zero exit
# or a logged-out signal means tomorrow's run will fail — flag it now.
OPEND_CHECK="${SIGHTLAB_SKILLS_DIR:-}/moomoo/scripts/check_opend.py"
if [ -n "${SIGHTLAB_SKILLS_DIR:-}" ] && [ -f "$OPEND_CHECK" ]; then
  if ! "$PYTHON_BIN" "$OPEND_CHECK" >/dev/null 2>&1; then
    alerts+=("数据网关 OpenD 当前不可用(check_opend 非零)——明天的 run 会失败,先登录 OpenD。")
  fi
else
  echo "$TS NOTE: OpenD check script not found at $OPEND_CHECK (skipping gateway check)" >>"$LOG"
fi

# --- report -------------------------------------------------------------------
if [ ${#alerts[@]} -eq 0 ]; then
  echo "$TS OK dispatch present + gateway up" >>"$LOG"
  exit 0
fi

MSG="⚠️ SightLab watchdog @ ${TS}：$(printf '%s ' "${alerts[@]}")手动补跑:bash run_sightlab_dispatch.sh。"
echo "$TS MISS ${alerts[*]}" >>"$LOG"
if [ -n "${TELEGRAM_API_KEY:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  curl -s -F "chat_id=${TELEGRAM_CHAT_ID}" --form-string "text=${MSG}" \
    "https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage" >/dev/null 2>&1 \
    && echo "$TS alert DM sent" >>"$LOG" \
    || echo "$TS alert DM FAILED" >>"$LOG"
else
  echo "$TS MISS but Telegram creds absent — cannot DM" >>"$LOG"
fi
exit 0
