import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link / email-OTP confirmation (the robust SSR flow).
 *
 * The branded magic-link email links here with `?token_hash=…&type=…&next=…`.
 * We verify the token_hash server-side via `verifyOtp` — this is PKCE-free, so
 * it does NOT depend on a `code_verifier` cookie from the requesting browser
 * (the failure mode of the default `/auth/v1/verify?token=pkce_…` → /auth/callback
 * flow, which 500s to "invalid or expired" when that cookie isn't present). On
 * success the cookie-bound server client writes the session, then we redirect to
 * `next`. `next` is forced to a same-site relative path (no open redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/account";
  const next = nextParam.startsWith("/") ? nextParam : "/account";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?auth_error=1`);
}
