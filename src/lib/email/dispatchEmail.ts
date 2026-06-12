import "server-only";
import type { Dispatch, FlowsSection6, CycleSection7 } from "@/lib/dispatch/types";
import type { Locale } from "@/lib/i18n/request";
import { pick } from "@/lib/i18n/pick";
import { etfDisplayName } from "@/lib/dispatch/etfNames";
import { CAVEAT } from "@/lib/content/caveat";
import { assertNoHoldings } from "@/lib/email/privacyGuard";

/**
 * Daily-digest email template (PLAN §15.3).
 *
 * Renders the dispatch as email-safe HTML: inline styles only, table-based
 * layout, web-safe fonts, a constrained width — the lowest-common-denominator
 * that survives Gmail/Outlook/Apple Mail. No external CSS, no <style> selectors
 * that clients strip.
 *
 * 🔒 PRIVACY (PLAN §15.4, LOCKED): this body carries ONLY market-wide §6 (fund
 * flows) + §7 (cycle / dispersion / Weinstein stage + market-structure sector
 * judgment). It NEVER renders holdings: no holding_note / 对持仓的话 /
 * portfolio-action / user-ticker buckets / §8 block. `assertNoHoldings()` is
 * called on the projected dispatch before any HTML is built — if a holdings
 * field ever leaks into the payload, rendering THROWS rather than emailing it.
 */

// ── Email palette (the locked amber accent on a light "paper" ground). Email
// clients are unreliable with dark mode, so the digest is always light. ──
const C = {
  bg: "#F7F4ED",
  surface: "#EDE7D7",
  border: "#C8C0AE",
  text: "#1A1814",
  text2: "#2C2620",
  muted: "#8A8074",
  primary: "#D97706",
  // accentText passes WCAG AA on cream (#F7F4ED): contrast ≈ 4.7:1.
  // primary (#D97706) is kept for borders/fills/wordmark dot (non-text uses).
  accentText: "#B45309",
  success: "#0F8A5F",
  danger: "#C84B31",
} as const;

const FONT_SERIF = "Georgia, 'Times New Roman', 'Noto Serif TC', 'Songti SC', serif";
const FONT_MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/** Per-locale UI label set for the email (self-contained — no next-intl context). */
interface Labels {
  subjectPrefix: string;
  glanceTitle: string;
  cycleStage: string;
  confidence: string;
  flowsTag: string;
  cycleTag: string;
  coreReading: string;
  dispersion: string;
  composite: string;
  todayCore: string;
  narrative: string;
  caveatLabel: string;
  s6: { etf: string; sector: string; thisWeek: string; signal: string; note: string };
  s7: { symbol: string; stage: string; distance: string; judgment: string };
  viewOnline: string;
  unsubscribe: string;
  optInNote: string;
  notAdvice: string;
}

const LABELS: Record<Locale, Labels> = {
  en: {
    subjectPrefix: "SightLab Daily Dispatch",
    glanceTitle: "At a glance",
    cycleStage: "Cycle stage",
    confidence: "Confidence",
    flowsTag: "WEEKLY FUND FLOWS · §6",
    cycleTag: "MARKET CYCLE · §7",
    coreReading: "Core reading",
    dispersion: "Sector dispersion",
    composite: "Composite read",
    todayCore: "Today's core read",
    narrative: "Weekly narrative",
    caveatLabel: "On reading this",
    s6: { etf: "ETF", sector: "Sector", thisWeek: "This wk", signal: "A/D", note: "Read" },
    s7: { symbol: "Sector", stage: "Stage", distance: "Dist", judgment: "Judgment" },
    viewOnline: "View on the web",
    unsubscribe: "Unsubscribe",
    optInNote: "You receive this because you opted in to the SightLab daily email.",
    notAdvice: "Market-wide research only — never personal holdings. Not investment advice.",
  },
  zh: {
    subjectPrefix: "SightLab 每日快报",
    glanceTitle: "速览",
    cycleStage: "周期阶段",
    confidence: "置信度",
    flowsTag: "每周资金流向 · §6",
    cycleTag: "市场周期 · §7",
    coreReading: "核心解读",
    dispersion: "板块离散度",
    composite: "综合读数",
    todayCore: "今日核心读数",
    narrative: "每周叙事",
    caveatLabel: "关于这份读数",
    s6: { etf: "ETF", sector: "板块", thisWeek: "本周", signal: "吸筹/派发", note: "解读" },
    s7: { symbol: "板块", stage: "阶段", distance: "距离", judgment: "判断" },
    viewOnline: "在网页查看",
    unsubscribe: "退订",
    optInNote: "你收到这封邮件，是因为你已选择订阅 SightLab 每日邮件。",
    notAdvice: "仅市场层面研究——绝不涉及个人持仓。非投资建议。",
  },
};

/** HTML-escape a text value before interpolating it into the email body. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function signalColor(signal: string): string {
  if (signal === "ACCUMULATION") return C.success;
  if (signal === "DISTRIBUTION") return C.danger;
  return C.muted;
}

// ── building blocks ──────────────────────────────────────────────────────

function sectionTag(text: string): string {
  return `<div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.accentText};margin:0 0 8px;">// ${esc(text)}</div>`;
}

function proseBlock(label: string, body: string): string {
  if (!body) return "";
  return `
    <div style="margin:14px 0 0;">
      <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};">${esc(label)}</div>
      <p style="font-family:${FONT_SERIF};font-size:15px;line-height:1.7;color:${C.text2};margin:6px 0 0;">${esc(body)}</p>
    </div>`;
}

function section6Html(s6: FlowsSection6, locale: Locale, L: Labels): string {
  const th = (t: string, align = "left") =>
    `<th scope="col" style="text-align:${align};font-family:${FONT_MONO};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.accentText};padding:6px 8px 6px 0;border-bottom:1px solid ${C.border};">${esc(t)}</th>`;

  const rows = s6.rows
    .map((r) => {
      const wkColor = r.this_week_return_pct >= 0 ? C.success : C.danger;
      return `
      <tr>
        <th scope="row" style="text-align:left;font-family:${FONT_MONO};font-size:13px;font-weight:600;color:${C.text};padding:8px 8px 8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(r.etf)}</th>
        <td style="font-family:${FONT_MONO};font-size:13px;color:${C.text2};padding:8px 8px 8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(etfDisplayName(r.etf, r.name_zh, locale))}</td>
        <td style="font-family:${FONT_MONO};font-size:13px;text-align:right;color:${wkColor};padding:8px 8px 8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(fmtPct(r.this_week_return_pct))}</td>
        <td style="font-family:${FONT_MONO};font-size:13px;font-weight:600;color:${signalColor(r.ad_signal)};padding:8px 8px 8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(r.ad_signal)}</td>
        <td style="font-family:${FONT_SERIF};font-size:14px;line-height:1.6;color:${C.text2};padding:8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(pick(r.signal, locale))}</td>
      </tr>`;
    })
    .join("");

  return `
    <div style="margin-top:28px;">
      ${sectionTag(L.flowsTag)}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
        <thead><tr>
          ${th(L.s6.etf)}${th(L.s6.sector)}${th(L.s6.thisWeek, "right")}${th(L.s6.signal)}${th(L.s6.note)}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${proseBlock(L.coreReading, pick(s6.core_reading, locale))}
    </div>`;
}

function section7Html(s7: CycleSection7, locale: Locale, L: Labels): string {
  const { composite, dispersion } = s7;
  const th = (t: string, align = "left") =>
    `<th scope="col" style="text-align:${align};font-family:${FONT_MONO};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.accentText};padding:6px 8px 6px 0;border-bottom:1px solid ${C.border};">${esc(t)}</th>`;

  const rows = s7.sectors
    .map(
      (s) => `
      <tr>
        <th scope="row" style="text-align:left;font-family:${FONT_MONO};font-size:13px;font-weight:600;color:${C.text};padding:8px 8px 8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(s.symbol)}</th>
        <td style="font-family:${FONT_MONO};font-size:13px;color:${C.text2};padding:8px 8px 8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">S${esc(String(s.weinstein_stage))}</td>
        <td style="font-family:${FONT_MONO};font-size:13px;text-align:right;color:${C.text2};padding:8px 8px 8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(fmtPct(s.distance_pct, 1))}</td>
        <td style="font-family:${FONT_SERIF};font-size:14px;line-height:1.6;color:${C.text2};padding:8px 0;border-bottom:1px dashed ${C.border};vertical-align:top;">${esc(pick(s.judgment, locale))}</td>
      </tr>`,
    )
    .join("");

  const summary = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin-top:6px;">
      <tr>
        <td style="width:50%;padding:12px;border:1px solid ${C.border};background:${C.surface};vertical-align:top;">
          <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};">${esc(L.composite)}</div>
          <div style="font-family:${FONT_MONO};font-size:18px;font-weight:600;color:${C.text};margin-top:4px;">${esc(composite.composite_precise.toFixed(2))}</div>
          <div style="font-family:${FONT_MONO};font-size:12px;color:${C.muted};margin-top:2px;">Stage ${esc(String(composite.cycle_stage_num))} · ${esc(composite.templeton_stage)} · ${esc(composite.confidence)}</div>
        </td>
        <td style="width:50%;padding:12px;border:1px solid ${C.border};border-left:0;background:${C.surface};vertical-align:top;">
          <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};">${esc(L.dispersion)}</div>
          <div style="font-family:${FONT_MONO};font-size:18px;font-weight:600;color:${C.text};margin-top:4px;">${esc(dispersion.dispersion_index.toFixed(1))}</div>
          <div style="font-family:${FONT_MONO};font-size:12px;color:${C.muted};margin-top:2px;">${esc(pick(dispersion.dispersion_label, locale))}</div>
        </td>
      </tr>
    </table>`;

  return `
    <div style="margin-top:32px;border-top:1px solid ${C.border};padding-top:24px;">
      ${sectionTag(L.cycleTag)}
      ${summary}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:16px;">
        <thead><tr>
          ${th(L.s7.symbol)}${th(L.s7.stage)}${th(L.s7.distance, "right")}${th(L.s7.judgment)}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${proseBlock(L.todayCore, pick(s7.today_core, locale))}
      ${s7.full_narrative ? proseBlock(L.narrative, pick(s7.full_narrative, locale)) : ""}
    </div>`;
}

// ── public API ─────────────────────────────────────────────────────────────

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Warn once per process, not once per recipient render.
let warnedNoPostalAddress = false;

/**
 * CAN-SPAM physical mailing address — env-driven (`SIGHTLAB_POSTAL_ADDRESS`),
 * NEVER a hardcoded placeholder.
 *
 * In production: THROWS if the env var is unset — the digest must not send
 * without a valid postal address (CAN-SPAM compliance).
 * In non-production: logs a warning and omits the line so dev/tests keep working.
 */
function postalAddress(): string | null {
  const addr = process.env.SIGHTLAB_POSTAL_ADDRESS?.trim();
  if (addr) return addr;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SIGHTLAB_POSTAL_ADDRESS is required in production (CAN-SPAM)");
  }
  if (!warnedNoPostalAddress) {
    warnedNoPostalAddress = true;
    console.warn(
      "dispatchEmail: SIGHTLAB_POSTAL_ADDRESS is unset — omitting the CAN-SPAM postal-address line from the digest footer.",
    );
  }
  return null;
}

/**
 * Render the bilingual daily-digest email for one recipient locale.
 *
 * @param dispatch    the projected (public) dispatch — market §6/§7 only.
 * @param locale      recipient's `profiles.locale`.
 * @param unsubUrl    fully-formed, signed unsubscribe URL for THIS recipient.
 * @param siteUrl     base site URL for the "view on the web" link.
 */
export function renderDispatchEmail(
  dispatch: Dispatch,
  locale: Locale,
  unsubUrl: string,
  siteUrl: string,
): RenderedEmail {
  // 🔒 LOCKED privacy invariant: throw before rendering if holdings ever leak.
  assertNoHoldings(dispatch);

  const L = LABELS[locale];
  const date = dispatch.dispatch_date;
  const subject = `${L.subjectPrefix} · ${date}`;

  const intro = pick({ en: dispatch.intro_en ?? "", zh: dispatch.intro_zh ?? "" }, locale);
  const glance = pick(
    { en: dispatch.at_a_glance_en ?? "", zh: dispatch.at_a_glance_zh ?? "" },
    locale,
  );

  const badge = dispatch.cycle_badge;
  const badgeHtml = badge
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
      <tr>
        <td style="padding:6px 12px;background:${C.surface};border:1px solid ${C.border};border-radius:4px;">
          <span style="font-family:${FONT_MONO};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};">${esc(L.cycleStage)}: </span>
          <span style="font-family:${FONT_MONO};font-size:13px;font-weight:600;color:${C.text};">Stage ${esc(String(badge.stage_num))} · ${esc(badge.templeton_stage)}</span>
          <span style="font-family:${FONT_MONO};font-size:12px;color:${C.muted};"> · ${esc(L.confidence)}: ${esc(badge.confidence)}</span>
        </td>
      </tr>
    </table>`
    : "";

  const glanceHtml = glance
    ? `
    <div style="margin-top:18px;padding:14px 16px;background:${C.surface};border:1px solid ${C.border};border-radius:4px;">
      <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.accentText};">${esc(L.glanceTitle)}</div>
      <p style="font-family:${FONT_SERIF};font-size:15px;line-height:1.7;color:${C.text2};margin:6px 0 0;">${esc(glance)}</p>
    </div>`
    : "";

  const caveat = pick(CAVEAT, locale);
  const postal = postalAddress();

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.bg};">

        <!-- masthead -->
        <tr><td style="border-bottom:2px solid ${C.text};padding-bottom:10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:${FONT_SERIF};font-size:24px;font-weight:700;color:${C.text};">SightLab<span style="color:${C.primary};">.</span></td>
            <td align="right" style="font-family:${FONT_MONO};font-size:12px;color:${C.muted};">${esc(date)}</td>
          </tr></table>
        </td></tr>

        <!-- intro -->
        ${intro ? `<tr><td style="padding-top:20px;"><p style="font-family:${FONT_SERIF};font-size:18px;line-height:1.7;color:${C.text2};margin:0;">${esc(intro)}</p></td></tr>` : ""}

        <!-- badge + at-a-glance -->
        <tr><td>${badgeHtml}${glanceHtml}</td></tr>

        <!-- §6 -->
        <tr><td>${section6Html(dispatch.flows_section6, locale, L)}</td></tr>
        <!-- §7 -->
        <tr><td>${section7Html(dispatch.cycle_section7, locale, L)}</td></tr>

        <!-- caveat -->
        <tr><td style="margin-top:28px;padding-top:20px;border-top:1px solid ${C.border};">
          <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};margin-top:24px;">${esc(L.caveatLabel)}</div>
          <p style="font-family:${FONT_SERIF};font-size:13px;line-height:1.65;color:${C.muted};margin:6px 0 0;">${esc(caveat)}</p>
        </td></tr>

        <!-- footer (CAN-SPAM hygiene) -->
        <tr><td style="padding-top:24px;margin-top:24px;border-top:1px solid ${C.border};">
          <p style="font-family:${FONT_MONO};font-size:11px;line-height:1.7;color:${C.muted};margin:16px 0 0;">
            <a href="${esc(siteUrl)}" style="color:${C.accentText};text-decoration:underline;">${esc(L.viewOnline)}</a>
            &nbsp;·&nbsp;
            <a href="${esc(unsubUrl)}" style="color:${C.accentText};text-decoration:underline;">${esc(L.unsubscribe)}</a>
          </p>
          <p style="font-family:${FONT_MONO};font-size:11px;line-height:1.6;color:${C.muted};margin:10px 0 0;">${esc(L.optInNote)}</p>
          <p style="font-family:${FONT_MONO};font-size:11px;line-height:1.6;color:${C.muted};margin:6px 0 0;">${esc(L.notAdvice)}</p>
          <p style="font-family:${FONT_MONO};font-size:11px;line-height:1.6;color:${C.muted};margin:6px 0 0;">SightLab · fysight.biz${postal ? ` · ${esc(postal)}` : ""}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Plain-text fallback (every email should carry one). Market prose only.
  const text = [
    `${L.subjectPrefix} · ${date}`,
    "",
    intro,
    "",
    badge
      ? `${L.cycleStage}: Stage ${badge.stage_num} · ${badge.templeton_stage} · ${L.confidence}: ${badge.confidence}`
      : "",
    glance ? `${L.glanceTitle}: ${glance}` : "",
    "",
    `${L.flowsTag}`,
    pick(dispatch.flows_section6.core_reading, locale),
    "",
    `${L.cycleTag}`,
    pick(dispatch.cycle_section7.today_core, locale),
    "",
    caveat,
    "",
    `${L.viewOnline}: ${siteUrl}`,
    `${L.unsubscribe}: ${unsubUrl}`,
    L.optInNote,
    L.notAdvice,
    postal ? `SightLab · fysight.biz · ${postal}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
