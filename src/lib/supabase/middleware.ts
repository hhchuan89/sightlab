import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Session-refresh helper for middleware (PLAN §6.3 job 1). Re-issues the
 * Supabase auth cookies on every matched request so the access token never goes
 * stale, and returns BOTH the response (carrying refreshed cookies) and the
 * resolved `user` so the caller can do coarse gating without a second round-trip.
 *
 * IMPORTANT (Supabase SSR contract): the response object created here must be
 * the one returned from middleware. If the caller needs to redirect, it must
 * copy these cookies onto the redirect response (see middleware.ts).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do NOT run code between createServerClient and getUser — getUser revalidates
  // the token with the auth server and triggers the cookie refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
