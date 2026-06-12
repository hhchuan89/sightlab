import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Dispatch, HistoryRow } from "./types";

/**
 * Dispatch read path — RPC ONLY (PLAN §14-B2), now PUBLIC (PLAN §15.1).
 *
 * v3 OPEN/FREE pivot: content is fully public. Every read goes through a PUBLIC
 * SECURITY DEFINER RPC (`*_public`) that returns the COMPLETE §6/§7 projection
 * to anon AND authenticated — no role check, no `is_locked` for content, full
 * history for everyone.
 *
 * HARD RULE (unchanged): app code NEVER selects the dispatches table directly;
 * RLS on the base table stays deny-all, so the RPC is the only read path. The
 * old role-gated RPCs remain in the DB as PARKED (PLAN §15) but are not called.
 */

/** Latest published dispatch, FULL content. `null` if none. */
export async function getLatest(): Promise<Dispatch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_latest_public");
  if (error) throw error;
  return (data as Dispatch | null) ?? null;
}

/** One dispatch by date-slug, FULL content, for any published date. `null` if missing. */
export async function getByDate(slug: string): Promise<Dispatch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dispatch_public", { p_slug: slug });
  if (error) throw error;
  return (data as Dispatch | null) ?? null;
}

/** Full PUBLIC history list (metadata only; the detail page fetches the body). */
export async function listHistory(limit = 60, offset = 0): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_dispatches_public", {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data as HistoryRow[] | null) ?? [];
}
