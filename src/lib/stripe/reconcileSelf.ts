import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

/**
 * /account reconcile fallback (PLAN §14-C4).
 *
 * Insurance against a stuck paying customer: a dropped Stripe webhook can leave
 * a real subscriber at role='free'. When /account loads and the profile has a
 * stripe_customer_id but role='free', we re-query Stripe for an active/trialing
 * subscription on that Customer and feed the facts to `sync_self_subscription`,
 * which upserts the caller's OWN subscription row and re-derives role via
 * reconcile_role.
 *
 * This deliberately does NOT import the service-role admin client (reserved for
 * ingest + webhook, §3.2). All writes go through the SECURITY DEFINER RPC, which
 * is constrained to the caller's own customer/uid.
 *
 * Returns true if it found an active sub and reconciled (caller can re-read the
 * role). Best-effort: any Stripe error is swallowed so the page still renders.
 */
export async function reconcileSelfFromStripe(customerId: string): Promise<boolean> {
  try {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });

    const active = subs.data.find((s) => s.status === "active" || s.status === "trialing");
    if (!active) return false;

    const price = active.items.data[0]?.price;
    const itemEnd = (active.items.data[0] as { current_period_end?: number } | undefined)
      ?.current_period_end;
    const subEnd = (active as { current_period_end?: number }).current_period_end;
    const periodEndSec = itemEnd ?? subEnd ?? null;

    const supabase = await createClient();
    const { error } = await supabase.rpc("sync_self_subscription", {
      p_stripe_subscription_id: active.id,
      p_stripe_customer_id: customerId,
      p_status: active.status,
      p_price_id: price?.id ?? null,
      p_interval: price?.recurring?.interval ?? null,
      p_current_period_end:
        typeof periodEndSec === "number" ? new Date(periodEndSec * 1000).toISOString() : null,
      p_cancel_at_period_end: active.cancel_at_period_end ?? false,
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}
