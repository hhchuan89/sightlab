#!/usr/bin/env python3
"""post_telegram.py — post a dispatch summary card to the SightLab Telegram channel.

Called by run_sightlab_dispatch.sh AFTER a successful ingest (best-effort: a post
failure must NOT fail the run — the dispatch is already published to the site).

Reads the SAME dispatch.json the Mac signed + POSTed to /api/ingest, and renders a
compact BILINGUAL (EN + 中文) card: cycle badge + at-a-glance + the actionable §6
fund-flow signals (only the non-NEUTRAL accumulation/distribution names — the full
table lives on the site) + a link to the full dispatch.

🔒 PRIVACY (PLAN §15.4): this reads ONLY the market-wide dispatch body (the exact
bytes already published publicly). It carries NO holdings — same contract as the
site/email. It additionally refuses to post if any holdings-shaped key appears.

ENV (from $CONFIG_DIR/.env):
  TELEGRAM_API_KEY              bot token (the bot must be a channel admin w/ post rights)
  SIGHTLAB_TELEGRAM_CHANNEL_ID  the channel id, e.g. -100xxxxxxxxxx
  NEXT_PUBLIC_SITE_URL          site base for the "full dispatch" link
                                (default https://sightlab.fysight.biz)

Usage:  post_telegram.py <dispatch.json>
Exit 0 on a posted message (prints message_id); non-zero on any failure.
"""
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request

HOLDINGS_KEY_RE = re.compile(r"holding|portfolio|持仓", re.I)


def die(msg: str) -> None:
    print(f"post_telegram: {msg}", file=sys.stderr)
    sys.exit(1)


def assert_no_holdings(value, path="") -> None:
    """Defense-in-depth (PLAN §15.4): refuse to post if any banned key appears."""
    if isinstance(value, dict):
        for k, v in value.items():
            if HOLDINGS_KEY_RE.search(str(k)):
                die(f"PRIVACY: holdings-shaped key '{path}.{k}' — refusing to post")
            assert_no_holdings(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            assert_no_holdings(v, f"{path}[{i}]")


def esc(s: str) -> str:
    """Telegram HTML parse_mode: escape &, <, > in dynamic text."""
    return html.escape(str(s), quote=False)


def build_message(d: dict, site: str) -> str:
    date = d["dispatch_date"]
    badge = d.get("cycle_badge", {})
    stage = badge.get("stage_num", "?")
    # templeton_stage is now bilingual {en, zh}; this card is English-led so show
    # the EN label (fall back to zh, then to a bare string for legacy bodies).
    templeton_raw = badge.get("templeton_stage", "")
    if isinstance(templeton_raw, dict):
        templeton = templeton_raw.get("en") or templeton_raw.get("zh") or ""
    else:
        templeton = templeton_raw
    conf = badge.get("confidence", "")
    glance = d.get("at_a_glance", {})

    # §6: surface only the actionable (non-NEUTRAL) names; the full table is on-site.
    rows = (d.get("flows_section6") or {}).get("rows", [])
    signals = [
        (r.get("etf", "?"), r.get("ad_signal", ""))
        for r in rows
        if r.get("ad_signal") and r["ad_signal"] != "NEUTRAL"
    ]
    if signals:
        sig_line = " · ".join(f"{esc(sym)} {esc(sig)}" for sym, sig in signals)
    else:
        sig_line = "All ETFs neutral this week / 本周全部中性"

    if d.get("kind") == "weekly":
        title = f"📊 <b>SightLab · Weekly Review</b> · {esc(date)}"
    else:
        title = f"📊 <b>SightLab</b> · {esc(date)}"

    lines = [
        title,
        "",
        f"<b>Cycle</b> Stage {esc(stage)} · {esc(templeton)} · Confidence {esc(conf)}",
        "",
        f"🇬🇧 {esc(glance.get('en', ''))}",
        f"🇨🇳 {esc(glance.get('zh', ''))}",
        "",
        f"<b>Fund-flow signal · 资金流信号 (§6)</b>",
        sig_line,
        "",
        f'🔗 <a href="{esc(site)}/dispatch">Full dispatch · 完整快报</a>',
    ]
    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) != 2:
        die("usage: post_telegram.py <dispatch.json>")
    token = os.environ.get("TELEGRAM_API_KEY")
    chat = os.environ.get("SIGHTLAB_TELEGRAM_CHANNEL_ID")
    site = (os.environ.get("NEXT_PUBLIC_SITE_URL") or "https://sightlab.fysight.biz").rstrip("/")
    if not token:
        die("TELEGRAM_API_KEY not set")
    if not chat:
        die("SIGHTLAB_TELEGRAM_CHANNEL_ID not set")

    with open(sys.argv[1], encoding="utf-8") as f:
        dispatch = json.load(f)
    assert_no_holdings(dispatch)

    text = build_message(dispatch, site)
    if len(text) > 4096:
        text = text[:4093] + "…"  # Telegram hard cap

    payload = urllib.parse.urlencode(
        {
            "chat_id": chat,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        }
    ).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage", data=payload, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.load(resp)
    except Exception as e:  # noqa: BLE001 — any transport error is a soft failure
        die(f"sendMessage failed: {e}")

    if not body.get("ok"):
        die(f"Telegram rejected: {body.get('description')}")
    print(f"post_telegram: OK message_id={body['result']['message_id']}")


if __name__ == "__main__":
    main()
