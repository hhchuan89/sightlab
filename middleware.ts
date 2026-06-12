import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware has exactly TWO jobs (PLAN §6.3, updated for §15):
 *   1. Refresh the Supabase session on every matched request.
 *   2. COARSE gating only:
 *        • /account  → auth-only  (no user → redirect to /login)
 *      /dispatch and /archive are PUBLIC in v3 (PLAN §15.1) — content is open to
 *      everyone, so they are NOT gated. Only /account (the distribution prefs:
 *      Telegram link + email opt-in) needs a signed-in user.
 *
 * The matcher EXCLUDES api/ingest and api/stripe/webhook (machine calls with
 * their own secrets; the webhook needs the raw body untouched).
 */
export async function middleware(request: NextRequest) {
  // Job 1: refresh session, get the response carrying refreshed cookies + user.
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // /account is a per-user surface — keep it out of any shared cache.
  if (pathname === "/account" || pathname.startsWith("/account/")) {
    response.headers.set("Cache-Control", "private, no-store");
  }

  // Job 2: coarse gating. Only /account is auth-only now; everything else
  // (including /dispatch and /archive) is public and passes through.
  const needsAuth = pathname === "/account" || pathname.startsWith("/account/");

  if (!needsAuth) {
    return response;
  }

  // Not signed in → bounce to /login.
  if (!user) {
    return redirectPreservingCookies(request, response, "/login");
  }

  return response;
}

/**
 * Build a redirect that carries over the refreshed auth cookies from the
 * session-refresh response (Supabase SSR contract: losing those cookies logs
 * the user out mid-request).
 */
function redirectPreservingCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  to: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = to;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  // Gating redirects are per-role decisions — never let them be cached either.
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export const config = {
  // Run on everything EXCEPT: Next internals, static files, and the two machine
  // endpoints (ingest + stripe webhook) which must not be touched by middleware.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|og/|api/ingest|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
