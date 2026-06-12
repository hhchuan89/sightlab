import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cookie-bound Supabase client for Server Components / Server Actions / Route
 * Handlers. RLS is IN FORCE: this uses the anon key and the user's session
 * cookie, so `auth.uid()` resolves to the signed-in user (or null for anon).
 * The SECURITY DEFINER dispatch RPCs key their role check off this uid.
 *
 * All app reads of dispatches go through this client via `supabase.rpc(...)`,
 * NEVER a direct select on the dispatches table (PLAN §14-B2; the committed
 * grep guard in supabase/tests/ fails the build on any such call).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // In a Server Component the cookie store is read-only; the attempt
          // throws and is swallowed. Session refresh is handled by middleware,
          // which CAN write cookies (see lib/supabase/middleware.ts).
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /* read-only context — middleware refreshes the session instead */
          }
        },
      },
    },
  );
}
