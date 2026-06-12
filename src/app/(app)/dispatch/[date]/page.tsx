import { notFound } from "next/navigation";
import { getByDate } from "@/lib/dispatch/queries";
import { DispatchArticle } from "@/components/dispatch/DispatchArticle";

/**
 * Dispatch detail page (PLAN §15.1 — content is PUBLIC).
 *
 * v3 OPEN/FREE pivot: anon AND authenticated callers see the COMPLETE §6/§7
 * dispatch for ANY published date. The single PUBLIC RPC `get_dispatch_public`
 * returns the full projection to everyone — no role check, no content paywall,
 * no LockedRegion. The old role-gated branch (CycleBadge + LockedRegion for
 * non-paid) is removed; `LockedRegion` stays in the repo as a parked file.
 */

// Caching not security-critical now (content is public), but harmless — keep
// force-dynamic so the page always reflects the latest published row.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * True only for a REAL calendar date in YYYY-MM-DD. The regex alone lets
 * impossible dates through (e.g. 2026-02-31), which the RPC's `::date` cast
 * turns into a 500 — round-trip through Date so those 404 instead.
 */
function isValidDateSlug(slug: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) return false;
  const parsed = new Date(`${slug}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === slug;
}

export default async function DispatchDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  // Guard against junk slugs AND impossible calendar dates before hitting the DB.
  if (!isValidDateSlug(date)) notFound();

  // Single PUBLIC RPC read — full content for everyone.
  const dispatch = await getByDate(date);
  if (!dispatch) notFound();

  return <DispatchArticle dispatch={dispatch} />;
}
