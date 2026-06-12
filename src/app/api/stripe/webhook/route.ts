import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

// Webhook must read the RAW request bytes for signature verification, so it can
// never be statically optimized or have its body parsed by the framework.
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — Stripe → DB state machine (PLAN §8.3, §14-C4).
 *
 * This route is EXCLUDED from middleware (see middleware.ts matcher) so the body
 * arrives untouched. It is the ONLY place besides /api/ingest that imports the
 * service-role admin client (PLAN §3.2 import policy).
 *
 * Contract enforced here:
 *  - Verify the signature on the RAW body (`await req.text()`), never req.json().
 *  - Idempotency ledger: insert into stripe_events(id) ON CONFLICT DO NOTHING.
 *    A duplicate (0 rows inserted) → 200 and stop, no reprocessing.
 *  - Consistency: the ledger row is the LAST write, committed only after the
 *    mutations succeed. If a mutation throws we DELETE the ledger row and return
 *    500 so Stripe retries and the retry is NOT short-circuited as a duplicate
 *    (PostgREST gives us no cross-statement transaction, so we emulate
 *    all-or-nothing by ordering the ledger write last + compensating on failure).
 *  - After any subscription mutation: reconcile_role(uid) — role is always
 *    re-derived from current subscriptions, never set from a single event.
 *  - current_period_end comes from the invoice line `period.end` (§14-C4: it
 *    moved off the subscription top-level for invoice events).
 */
export async function POST(req: NextRequest) {
  // PARKED (PLAN §15): v3 has no paid tier. Without Stripe env this surface does
  // not exist — fail closed BEFORE any Stripe client is constructed.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // RAW body FIRST — verify the signature against the exact bytes Stripe signed.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid_signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Idempotency: claim the event id. ON CONFLICT DO NOTHING + a returning
  // select tells us whether THIS request is the one that inserted it.
  const { data: inserted, error: ledgerErr } = await admin
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");

  if (ledgerErr) {
    // Could not even record the event → ask Stripe to retry (do not process).
    return NextResponse.json({ error: "ledger_failed" }, { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    // Already processed (or in flight) → ack and stop. No double-processing.
    return NextResponse.json({ received: true, duplicate: true });
  }

  // The ledger row now exists. Process the state machine; if ANYTHING throws,
  // remove the ledger row so Stripe's retry re-enters instead of being treated
  // as a duplicate (keeps the ledger + mutations consistent — §8.3).
  try {
    await processEvent(admin, event);
  } catch (err) {
    await admin.from("stripe_events").delete().eq("id", event.id);
    const message = err instanceof Error ? err.message : "processing_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createAdminClient>;

async function processEvent(admin: Admin, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = resolveUid(session.client_reference_id, session.metadata);
      const customerId = stripeId(session.customer);

      if (uid && customerId) {
        // Persist the customer mapping (the user-client may have written it
        // pre-checkout; this is the authoritative confirmation).
        await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", uid);
      }

      // The subscription row usually arrives via customer.subscription.created,
      // but if the session already carries one, upsert it now so access is
      // immediate rather than waiting on event ordering.
      const subId = stripeId(session.subscription);
      if (uid && subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        await upsertSubscription(admin, sub, uid);
      }
      if (uid) await reconcile(admin, uid);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = await resolveUidForSubscription(admin, sub);
      if (!uid) return; // unmapped customer — nothing to reconcile

      const deleted = event.type === "customer.subscription.deleted";
      await upsertSubscription(admin, sub, uid, deleted ? "canceled" : undefined);
      await reconcile(admin, uid);
      return;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdFromInvoice(invoice);
      if (!subId) return; // not a subscription invoice

      const uid = await resolveUidForCustomer(admin, stripeId(invoice.customer));
      if (!uid) return;

      const paid = event.type === "invoice.paid";
      // §14-C4: current_period_end comes from the invoice LINE period.end.
      const periodEnd = periodEndFromInvoice(invoice);

      await admin.from("subscriptions").upsert(
        {
          stripe_subscription_id: subId,
          user_id: uid,
          // invoice.paid → active (covers renewals + past_due recovery);
          // payment_failed → past_due (reconcile treats it as not-paid; access
          // lapses naturally and a later invoice.paid restores it).
          status: paid ? "active" : "past_due",
          ...(periodEnd ? { current_period_end: periodEnd } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );
      await reconcile(admin, uid);
      return;
    }

    default:
      // Unhandled event type — already in the ledger, ack as processed.
      return;
  }
}

// --- helpers ---------------------------------------------------------------

function resolveUid(
  clientReferenceId: string | null,
  metadata: Stripe.Metadata | null,
): string | null {
  return clientReferenceId ?? metadata?.supabase_user_id ?? null;
}

/** Stripe expandable field → the id string (or null). */
function stripeId(field: string | { id: string } | null | undefined): string | null {
  if (!field) return null;
  return typeof field === "string" ? field : field.id;
}

/** Resolve the Supabase user id for a subscription event. */
async function resolveUidForSubscription(
  admin: Admin,
  sub: Stripe.Subscription,
): Promise<string | null> {
  // Preferred: the metadata we stamped at checkout (subscription_data.metadata).
  const fromMeta = sub.metadata?.supabase_user_id;
  if (fromMeta) return fromMeta;
  // Fallback: map via the customer id on profiles.
  return resolveUidForCustomer(admin, stripeId(sub.customer));
}

async function resolveUidForCustomer(
  admin: Admin,
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function upsertSubscription(
  admin: Admin,
  sub: Stripe.Subscription,
  uid: string,
  forceStatus?: string,
): Promise<void> {
  const price = sub.items.data[0]?.price;
  const { error } = await admin.from("subscriptions").upsert(
    {
      stripe_subscription_id: sub.id,
      user_id: uid,
      status: forceStatus ?? sub.status,
      price_id: price?.id ?? null,
      interval: price?.recurring?.interval ?? null,
      current_period_end: periodEndFromSubscription(sub),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(`subscription upsert failed: ${error.message}`);
}

async function reconcile(admin: Admin, uid: string): Promise<void> {
  const { error } = await admin.rpc("reconcile_role", { p_user: uid });
  if (error) throw new Error(`reconcile_role failed: ${error.message}`);
}

/** Find the subscription id an invoice belongs to (top-level or via a line). */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const top = stripeId((invoice as { subscription?: string | { id: string } | null }).subscription);
  if (top) return top;
  for (const line of invoice.lines?.data ?? []) {
    const lineSub = stripeId(
      (line as { subscription?: string | { id: string } | null }).subscription,
    );
    if (lineSub) return lineSub;
  }
  return null;
}

/**
 * §14-C4: read current_period_end from the invoice LINE `period.end`. We take
 * the subscription line's period (the one carrying the active billing window).
 */
function periodEndFromInvoice(invoice: Stripe.Invoice): string | null {
  const lines = invoice.lines?.data ?? [];
  // Prefer a subscription-type line; fall back to the last line's period.
  const subLine =
    lines.find((l) => (l as { type?: string }).type === "subscription") ?? lines[lines.length - 1];
  const end = subLine?.period?.end;
  return typeof end === "number" ? new Date(end * 1000).toISOString() : null;
}

/**
 * For customer.subscription.* events the period end still lives on the item /
 * subscription. Try the item's current_period_end first, then the sub's.
 */
function periodEndFromSubscription(sub: Stripe.Subscription): string | null {
  const itemEnd = (sub.items.data[0] as { current_period_end?: number } | undefined)
    ?.current_period_end;
  const subEnd = (sub as { current_period_end?: number }).current_period_end;
  const end = itemEnd ?? subEnd;
  return typeof end === "number" ? new Date(end * 1000).toISOString() : null;
}
