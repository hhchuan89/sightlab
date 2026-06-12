import { createClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE Supabase client — BYPASSES RLS. It can read/write every table,
 * including `profiles` (user emails, opt-in flags) and the dispatches rows.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ IMPORT POLICY (ENFORCED, PLAN §3.2 / §6.4 / risk #7):                      │
 * │ This module may be imported ONLY by routes that NEED privileged access:     │
 * │   • src/app/api/ingest/route.ts        (Mac → DB service-role write +       │
 * │     digest fan-out via lib/email/sendDigest)                                │
 * │   • src/app/api/unsubscribe/route.ts   (no-session opt-out write)           │
 * │   • src/app/api/stripe/webhook/route.ts (parked — Stripe → DB)              │
 * │ Importing it anywhere else (a page, a server component, another route)      │
 * │ hands that code unrestricted reads of user PII and unrestricted writes,     │
 * │ with RLS giving zero protection. If you need dispatch data in app code,     │
 * │ use the cookie-bound client (lib/supabase/server.ts) + the public RPCs.     │
 * │ The service-role key must NEVER reach the browser or the Mac.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
