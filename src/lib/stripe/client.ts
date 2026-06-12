import Stripe from "stripe";

/**
 * Server-only Stripe SDK init.
 *
 * PINNED apiVersion (PLAN §14-C4 / §14-S7): the version is hard-coded, NOT left
 * to the SDK default. An un-pinned client silently adopts whatever version the
 * account is on, so a future dashboard "API version upgrade" could reshape
 * webhook/Checkout payloads under our feet without a code change. Pinning makes
 * the contract explicit and the upgrade deliberate. This literal must match the
 * SDK's LatestApiVersion type (stripe@17 → '2025-02-24.acacia'); bump both
 * together when upgrading the SDK.
 *
 * SERVER-ONLY: this reads STRIPE_SECRET_KEY, which must never reach the browser.
 * It is imported only by the /api/stripe/* route handlers and server-side
 * helpers — never a client component.
 *
 * LAZY: the client is built on first use (a Proxy), NOT at module load. This
 * matches lib/supabase/admin.ts (a factory, not a module-level instance) and
 * keeps `next build` page-data collection from throwing when the key is absent
 * in the build environment — the env is only required at request time.
 */
const PINNED_API_VERSION = "2025-02-24.acacia" as const;

let cached: Stripe | null = null;

function getStripe(): Stripe {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required (server-only).");
  }
  cached = new Stripe(secretKey, {
    apiVersion: PINNED_API_VERSION,
    typescript: true,
  });
  return cached;
}

/**
 * Proxy that defers construction to first property access, so `import { stripe }`
 * never evaluates the SDK (or reads the secret) at module-load time.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
