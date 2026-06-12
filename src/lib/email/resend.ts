import "server-only";
import { Resend } from "resend";

/**
 * Resend client (PLAN §15.3) — SERVER ONLY.
 *
 * The daily email digest goes out via Resend. The API key is read from the
 * environment lazily (not at module load) so importing this file in a context
 * that never sends — e.g. a typecheck or a build that tree-shakes it — does not
 * throw on a missing key. `getResend()` throws only when an actual send is
 * attempted without the key configured.
 *
 * `EMAIL_FROM` is the pinned, verified sender on a `fysight.biz` subdomain, e.g.
 * "SightLab <dispatch@mail.fysight.biz>", set via `SIGHTLAB_EMAIL_FROM`. Sending
 * from an unverified address gets the mail bounced/spam-filed, so this is env-
 * driven, not hardcoded — but it is the ONE place the sender is defined.
 */

let cached: Resend | null = null;

/** Lazily construct the Resend client. Throws if `RESEND_API_KEY` is unset. */
export function getResend(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "getResend: RESEND_API_KEY is required to send email (server-only, PLAN §15.3).",
    );
  }
  cached = new Resend(apiKey);
  return cached;
}

/** The pinned verified sender. Throws if `SIGHTLAB_EMAIL_FROM` is unset. */
export function emailFrom(): string {
  const from = process.env.SIGHTLAB_EMAIL_FROM;
  if (!from) {
    throw new Error(
      "emailFrom: SIGHTLAB_EMAIL_FROM is required (e.g. 'SightLab <dispatch@mail.fysight.biz>').",
    );
  }
  return from;
}
