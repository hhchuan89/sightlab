import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key, RLS in force). Used by client components
 * that need the session (e.g. reacting to auth state). Never holds the service
 * role key. Like the server client, it MUST NOT read the dispatches table
 * directly — dispatch reads go through the RPCs (PLAN §14-B2).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
