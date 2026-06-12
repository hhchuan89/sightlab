import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, emailFrom } from "@/lib/email/resend";
import { renderDispatchEmail } from "@/lib/email/dispatchEmail";
import { makeUnsubToken } from "@/lib/email/unsubToken";
import { assertNoHoldings } from "@/lib/email/privacyGuard";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/request";
import type { Dispatch } from "@/lib/dispatch/types";

/**
 * Daily email digest fan-out (PLAN §15.3).
 *
 * Given a freshly-ingested dispatch, fetch every `email_opt_in = true` profile
 * (service-role admin client — RLS does not expose the whole user list to app
 * code), render the bilingual digest per recipient locale, and send via Resend
 * in BATCHES to respect rate limits. Each email carries a per-recipient signed
 * unsubscribe token. Failures are LOGGED, never thrown — one bad address must
 * not abort the whole run (PLAN: "never throw the whole batch on one failure").
 *
 * NOT wired to any trigger here — IngestMac calls `sendDigest(dispatch)` after a
 * successful ingest (PLAN §15.3). This module only exports the function.
 *
 * 🔒 PRIVACY (PLAN §15.4): `assertNoHoldings(dispatch)` runs ONCE up front; if
 * the payload carries holdings the whole send aborts before any email goes out.
 */

/** Resend's batch endpoint caps at 100 messages per call; stay under it. */
const BATCH_SIZE = 100;

export interface SendDigestResult {
  attempted: number;
  sent: number;
  failed: number;
}

interface OptInProfile {
  id: string;
  email: string | null;
  locale: string | null;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sightlab.fysight.biz").replace(/\/$/, "");
}

function unsubscribeUrl(userId: string): string {
  return `${siteUrl()}/api/unsubscribe?token=${encodeURIComponent(makeUnsubToken(userId))}`;
}

function normalizeLocale(value: string | null): Locale {
  return value === "zh" || value === "en" ? value : DEFAULT_LOCALE;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Send the daily digest of `dispatch` to all opted-in users.
 * @returns counts (attempted / sent / failed). Never throws on a send failure;
 *          throws only on a privacy violation or an inability to load recipients.
 */
export async function sendDigest(dispatch: Dispatch): Promise<SendDigestResult> {
  // Fail loud BEFORE touching the recipient list (PLAN §15.4 LOCKED).
  assertNoHoldings(dispatch);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, locale")
    .eq("email_opt_in", true);

  if (error) {
    throw new Error(`sendDigest: failed to load opt-in profiles: ${error.message}`);
  }

  const recipients = ((data ?? []) as OptInProfile[]).filter(
    (p): p is OptInProfile & { email: string } =>
      typeof p.email === "string" && p.email.includes("@"),
  );

  const result: SendDigestResult = { attempted: recipients.length, sent: 0, failed: 0 };
  if (recipients.length === 0) return result;

  const resend = getResend();
  const from = emailFrom();
  const site = siteUrl();

  for (const group of chunk(recipients, BATCH_SIZE)) {
    const payload = group.map((p) => {
      const locale = normalizeLocale(p.locale);
      const unsubUrl = unsubscribeUrl(p.id);
      const { subject, html, text } = renderDispatchEmail(dispatch, locale, unsubUrl, site);
      return {
        from,
        to: [p.email],
        subject,
        html,
        text,
        // RFC 2369 / RFC 8058 one-click unsubscribe — per-recipient signed URL.
        // Gmail/Yahoo bulk-sender rules require these on every message.
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    try {
      const { error: batchError } = await resend.batch.send(payload);
      if (batchError) {
        // Whole-batch error (e.g. auth/rate-limit): log, count as failed, continue.
        result.failed += group.length;
        console.error(
          `sendDigest: batch of ${group.length} failed: ${batchError.message ?? String(batchError)}`,
        );
      } else {
        result.sent += group.length;
      }
    } catch (err) {
      // Network/transport throw: never let it abort the remaining batches.
      result.failed += group.length;
      console.error(
        `sendDigest: batch of ${group.length} threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.info(
    `sendDigest: dispatch ${dispatch.dispatch_date} — attempted ${result.attempted}, sent ${result.sent}, failed ${result.failed}`,
  );
  return result;
}
