import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal — open the Stripe Customer Portal for the signed-in
 * user (PLAN §8.2): plan change / cancel / card update all live there, so we
 * never build those flows ourselves.
 *
 * We resolve the customer id from the user's own profile (RLS-scoped read). If
 * the user has no customer id yet they have never checked out — `no_customer`
 * rather than erroring.
 */
export async function POST(_req: NextRequest) {
  // PARKED (PLAN §15): v3 has no paid tier. Without Stripe env this surface does
  // not exist — fail closed BEFORE any Stripe client/work is touched.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json({ error: "server_misconfig" }, { status: 500 });
  }
  if (!customerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/account`,
  });

  return NextResponse.json({ url: session.url });
}
