import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Role = "free" | "paid";

export type Session = { user: User; role: Role } | { user: null; role: "free" };

/**
 * Resolve the current { user, role } on the server.
 *
 * SINGLE ROLE SOURCE (PLAN §14-C3): `role` is read from `profiles.role` ONLY —
 * the webhook-maintained truth. It is NEVER derived from a `subscriptions` row
 * in app code. Anonymous callers are treated as `free`. A missing/unreadable
 * profile also resolves to `free` (fail-closed: paid access requires an
 * explicit `'paid'`).
 */
export async function getSession(): Promise<Session> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: "free" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role: Role = profile?.role === "paid" ? "paid" : "free";
  return { user, role };
}
