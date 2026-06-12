"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Client checkout trigger (PLAN §8.2). POSTs the chosen plan to
 * /api/stripe/checkout and redirects the browser to the Stripe-hosted Checkout
 * URL the server returns. Signed-out visitors are sent to /login first — the
 * server route would 401 otherwise.
 */
export function CheckoutButton({
  plan,
  label,
  signedIn,
}: {
  plan: "monthly" | "yearly";
  label: string;
  signedIn: boolean;
}) {
  const t = useTranslations("pricing");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  if (!signedIn) {
    return (
      <a
        href={`/login?next=${encodeURIComponent("/pricing")}`}
        className="mt-7 block rounded-full bg-primary px-6 py-3 text-center font-mono text-sm font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-primary-hover"
      >
        {t("signInToSubscribe")}
      </a>
    );
  }

  async function start() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return; // navigating away; keep the spinner state
      }
      setError(true);
      setPending(false);
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="w-full rounded-full bg-primary px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? t("starting") : label}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {t("checkoutError")}
        </p>
      ) : null}
    </div>
  );
}
