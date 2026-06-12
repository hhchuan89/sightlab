import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

// Creates a session against the live Stripe API — never prerender/cache.
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout — create a Stripe Checkout Session for the
 * signed-in user (PLAN §8.2, §14-C5).
 *
 * Body: { plan: "monthly" | "yearly" }.
 *
 * ONE Customer per user (§14-C5): if `profiles.stripe_customer_id` is null we
 * create the Customer, WRITE IT BACK to profiles BEFORE creating the session,
 * and reuse it on every later checkout. Both the Customer and the Session
 * creation carry a Stripe idempotency key so a double-submit (or a retry after a
 * network blip) can never mint a second Customer or a duplicate session.
 *
 * The webhook is the source of truth for role — this route only opens Checkout.
 * We still set client_reference_id AND subscription_data.metadata.supabase_user_id
 * so the webhook can resolve the uid from either the session or the subscription.
 */
export async function POST(req: NextRequest) {
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

  let plan: unknown;
  try {
    plan = (await req.json())?.plan;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (plan !== "monthly" && plan !== "yearly") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const priceId =
    plan === "monthly" ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!priceId || !siteUrl) {
    return NextResponse.json({ error: "server_misconfig" }, { status: 500 });
  }

  // --- one Customer per user ---------------------------------------------
  // Read the existing customer id off the user-scoped profile (RLS lets a user
  // read their own row).
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    // Idempotency key is keyed on the user id so a concurrent/retried checkout
    // resolves to the SAME Customer instead of creating a duplicate.
    const customer = await stripe.customers.create(
      {
        email: user.email ?? profile?.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      },
      { idempotencyKey: `customer:${user.id}` },
    );
    customerId = customer.id;

    // Write the id back BEFORE creating the session so every future checkout
    // reuses it. The user client cannot UPDATE profiles (no RLS policy), so the
    // write goes through the RPC the migration exposes for exactly this.
    const { error: writeErr } = await supabase.rpc("set_stripe_customer_id", {
      p_customer_id: customerId,
    });
    if (writeErr) {
      return NextResponse.json({ error: "customer_persist_failed" }, { status: 500 });
    }
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // uid resolution path #1 (the session itself):
      client_reference_id: user.id,
      // uid resolution path #2 (stamped onto the subscription so
      // customer.subscription.* events can resolve the user too):
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${siteUrl}/account?checkout=success`,
      // /pricing is parked (src/parked/pricing) and no longer routes.
      cancel_url: `${siteUrl}/signup?checkout=cancelled`,
      allow_promotion_codes: false,
    },
    // Scope the idempotency key to the user+plan so a double-click reuses the
    // same session rather than opening two.
    { idempotencyKey: `checkout:${user.id}:${plan}` },
  );

  if (!session.url) {
    return NextResponse.json({ error: "session_no_url" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
