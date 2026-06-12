"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Client trigger for the Stripe Customer Portal (PLAN §8.2). POSTs to
 * /api/stripe/portal and redirects to the portal URL the server returns.
 */
export function PortalButton() {
  const t = useTranslations("account");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(true);
      setPending(false);
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors hover:border-primary hover:text-accent disabled:opacity-60"
      >
        {pending ? t("portalOpening") : t("manageBilling")}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {t("portalError")}
        </p>
      ) : null}
    </div>
  );
}
