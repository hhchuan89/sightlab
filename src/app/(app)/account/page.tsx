import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { setEmailOptIn } from "./actions";

// PARKED — reserved for a future paid tier (PLAN §15). When a paid tier returns,
// re-import these and render <PortalButton /> in the account body. Content is no
// longer gated by billing, so they sit dormant.
// import { reconcileSelfFromStripe } from "@/lib/stripe/reconcileSelf";
// import { PortalButton } from "./PortalButton";

// Per-user render: never cache (PLAN §14-C7).
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  // Middleware gates /account auth-only; re-resolve here so the page is correct
  // even if reached directly, and to read the user's prefs for display.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("account");

  // Read the user's email-digest opt-in (PLAN §15.2).
  const { data: profile } = await supabase
    .from("profiles")
    .select("email_opt_in")
    .eq("id", user.id)
    .maybeSingle();

  const optedIn = profile?.email_opt_in ?? false;

  // Telegram invite link — shown ONLY to authenticated users (PLAN §15.2).
  // Channel joins are moderated manually; absent env → hide the row.
  const telegramInvite = process.env.SIGHTLAB_TELEGRAM_INVITE_LINK ?? null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl font-semibold text-text">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      <dl className="mt-8 divide-y divide-border rounded-lg border border-border">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="label-mono text-text-2">{t("emailLabel")}</dt>
          <dd className="text-sm text-text">{user.email}</dd>
        </div>
      </dl>

      {/* Daily-email opt-in (PLAN §15.2/§15.3). Plain server-action submit; the
          desired value is the OPPOSITE of the current state. */}
      <form action={setEmailOptIn} className="mt-8 rounded-lg border border-border p-4">
        <input type="hidden" name="opt_in" value={(!optedIn).toString()} />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text">{t("emailOptInTitle")}</p>
            <p className="mt-1 text-sm text-text-2">{t("emailOptInBody")}</p>
          </div>
          <button
            type="submit"
            role="switch"
            aria-checked={optedIn}
            aria-label={t("emailOptInToggle")}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              optedIn ? "bg-primary" : "bg-surface-2"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-bg transition-transform ${
                optedIn ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          {optedIn ? t("emailOptInOn") : t("emailOptInOff")}
        </p>
      </form>

      {/* Telegram invite — authenticated-only (PLAN §15.2). */}
      {telegramInvite ? (
        <div className="mt-8 rounded-lg border border-border p-4">
          <p className="text-sm font-semibold text-text">{t("telegramTitle")}</p>
          <p className="mt-1 text-sm text-text-2">{t("telegramBody")}</p>
          <a
            href={telegramInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-full bg-primary px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-text transition-colors hover:bg-primary-hover"
          >
            {t("telegramJoin")}
          </a>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3">
        {/* PARKED — Stripe Customer Portal (PLAN §15). When a paid tier returns,
            flip PAID_TIER and render <PortalButton /> here. Content is no longer
            gated by billing. */}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors hover:border-primary hover:text-accent"
          >
            {t("signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
