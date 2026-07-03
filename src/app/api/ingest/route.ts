import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateIngestBody, type DispatchIngestBody } from "@/lib/ingest/schema";

/**
 * POST /api/ingest — Mac harness → DB (PLAN §7.2, §14-B5/C1/S1, §15.4).
 *
 * This route is EXCLUDED from middleware (see middleware.ts matcher) so the body
 * arrives untouched, and it is one of only two routes that import the
 * service-role admin client (the other is the Stripe webhook).
 *
 * Order is load-bearing (PLAN §14-B5):
 *   1. `const raw = await req.text()` FIRST — the EXACT bytes the Mac signed.
 *   2. Constant-time bearer compare.
 *   3. HMAC-SHA256 over the RAW string, constant-time compare — BEFORE JSON.parse.
 *   4. Date guard: a `x-sightlab-date` header must equal the body's dispatch_date
 *      and be within ±1 day of "now" (no stale/future replays).
 *   5. JSON.parse → §15.4 holdings guard → zod validation (422 on any failure).
 *   6. UPSERT keyed on dispatch_date (idempotent re-POST overwrites — clears the
 *      "Delayed" banner / backfills EN on a soft-fail re-run).
 *
 * (The former step 7 — the email digest fan-out — was REMOVED for good on
 * 2026-07-03, PLAN §15.3. Delivery is the site + the Telegram channel.)
 *
 * Never call req.json() — the HMAC must run over the raw bytes first.
 */
export const dynamic = "force-dynamic";

/** Constant-time string compare that never short-circuits on length. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Compare against self to keep the timing path constant, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const bearerSecret = process.env.SIGHTLAB_INGEST_SECRET;
  const hmacKey = process.env.SIGHTLAB_INGEST_HMAC_KEY;
  if (!bearerSecret || !hmacKey) {
    // Misconfigured server — fail closed (do NOT accept unsigned writes).
    console.error("ingest: SIGHTLAB_INGEST_SECRET / SIGHTLAB_INGEST_HMAC_KEY not set");
    return json(500, { error: "ingest_not_configured" });
  }

  // (1) RAW bytes FIRST — everything authenticates against these exact bytes.
  const raw = await req.text();

  // (2) Bearer (constant-time).
  const authHeader = req.headers.get("authorization") ?? "";
  const presentedBearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!safeEqual(presentedBearer, bearerSecret)) {
    return json(401, { error: "unauthorized" });
  }

  // (3) HMAC-SHA256 over the RAW string, constant-time, BEFORE JSON.parse.
  const presentedSig = (req.headers.get("x-sightlab-signature") ?? "").trim();
  const expectedSig = createHmac("sha256", hmacKey).update(raw, "utf8").digest("hex");
  if (!safeEqual(presentedSig, expectedSig)) {
    return json(401, { error: "bad_signature" });
  }

  // (4) Date guard header — must equal the body's dispatch_date and be sane.
  const dateHeader = (req.headers.get("x-sightlab-date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateHeader)) {
    return json(401, { error: "missing_date_header" });
  }
  if (!withinOneDay(dateHeader)) {
    return json(401, { error: "date_out_of_range" });
  }

  // (5) Parse + validate. JSON.parse only AFTER auth (PLAN §14-B5).
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(422, { error: "invalid_json" });
  }

  const result = validateIngestBody(parsed);
  if (!result.ok || !result.data) {
    return json(422, { error: "validation_failed", detail: result.error });
  }
  const body = result.data;

  // The date-guard header must match the body the Mac signed (no header/body skew).
  if (body.dispatch_date !== dateHeader) {
    return json(401, { error: "date_header_mismatch" });
  }

  // (6) UPSERT keyed on dispatch_date (idempotent). Service-role write.
  const admin = createAdminClient();
  const { error: upsertErr } = await admin
    .from("dispatches")
    .upsert(rowFromBody(body), { onConflict: "dispatch_date" });
  if (upsertErr) {
    console.error(`ingest: upsert failed for ${body.dispatch_date}: ${upsertErr.message}`);
    return json(500, { error: "db_write_failed" });
  }

  // (7) The email digest that used to fan out here was REMOVED for good on
  // 2026-07-03 (decision §三-C): CAN-SPAM requires a physical postal address
  // and exposing a personal one is not acceptable. Distribution is the site +
  // the Telegram channel. `dispatches.digest_sent_at` / `profiles.email_opt_in`
  // remain as unused DB columns (dropping them is not worth a migration).

  return json(200, { ok: true, dispatch_date: body.dispatch_date });
}

/** dispatch_date must be within ±1 day of the server's "now" (UTC). */
function withinOneDay(dateStr: string): boolean {
  const day = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(day)) return false;
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  // Allow [now - 1d, now + 1d] on the date's midnight, generously (±~2d window
  // on the clock to absorb tz skew while still rejecting stale/far-future dates).
  return Math.abs(now - day) <= 2 * ONE_DAY;
}

/**
 * Map the validated ingest body → a `dispatches` table row (PLAN §3.1 columns).
 */
function rowFromBody(b: DispatchIngestBody) {
  return {
    dispatch_date: b.dispatch_date,
    generated_at: b.generated_at,
    kind: b.kind,
    published: true,
    intro_en: b.intro.en,
    intro_zh: b.intro.zh,
    at_a_glance_en: b.at_a_glance.en,
    at_a_glance_zh: b.at_a_glance.zh,
    cycle_badge: b.cycle_badge,
    flows_section6: b.flows_section6,
    cycle_section7: b.cycle_section7,
    deepread_section: b.deepread_section, // §15.9 (null when producer predates it)
    teaser_en: b.teaser.en,
    teaser_zh: b.teaser.zh,
  };
}
