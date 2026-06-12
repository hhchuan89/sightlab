import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed unsubscribe tokens (PLAN §15.3).
 *
 * A token is `base64url(userId).base64url(hmacSHA256(userId, secret))`. The
 * unsubscribe link carries it; `/api/unsubscribe` verifies the signature before
 * flipping `email_opt_in`. Because the user id is HMAC-signed with a SERVER
 * secret (`SIGHTLAB_UNSUB_SECRET`), an attacker cannot forge a token for an
 * arbitrary user — without the secret they cannot produce a valid signature.
 *
 * The token is intentionally not time-limited: unsubscribe links in old emails
 * must keep working forever (CAN-SPAM). The action is idempotent and low-risk
 * (it only turns a preference OFF), so a long-lived signed id is the right call.
 */

function secret(): string {
  const s = process.env.SIGHTLAB_UNSUB_SECRET;
  if (!s) {
    throw new Error(
      "SIGHTLAB_UNSUB_SECRET is required to sign/verify unsubscribe tokens (server-only).",
    );
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(userId: string): string {
  return createHmac("sha256", secret()).update(userId).digest("base64url");
}

/** Build a signed unsubscribe token for a user id. */
export function makeUnsubToken(userId: string): string {
  return `${b64url(userId)}.${sign(userId)}`;
}

/**
 * Verify a token and return the user id, or `null` if it is malformed or the
 * signature does not match. Constant-time signature compare.
 */
export function verifyUnsubToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const idPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  let userId: string;
  try {
    userId = Buffer.from(idPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = sign(userId);
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return userId;
}
