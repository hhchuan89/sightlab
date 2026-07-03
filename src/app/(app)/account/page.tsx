import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { inviteQrSvg } from "@/lib/qr";
import { AgentTokensCard, type AgentTokenRow } from "./AgentTokensCard";

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

  // MCP personal tokens (PLAN §15.10) — the user's own rows via RLS.
  const { data: tokenRows } = await supabase
    .from("agent_tokens")
    .select("id, last4, created_at, day_count, day_date")
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  const agentTokens: AgentTokenRow[] = tokenRows ?? [];
  const todayUtc = new Date().toISOString().slice(0, 10);

  // Telegram invite link — shown ONLY to authenticated users (PLAN §15.2).
  // Channel joins are moderated manually; absent env → hide the row.
  const telegramInvite = process.env.SIGHTLAB_TELEGRAM_INVITE_LINK ?? null;
  // QR encodes the SAME invite URL, generated server-side and ONLY when the link
  // exists (so it inherits the §15.2 auth gate and never reaches an anon client).
  const telegramQr = telegramInvite ? await inviteQrSvg(telegramInvite) : null;

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

      {/* Email digest was REMOVED for good (decision 2026-07-03, PLAN §15.3):
          CAN-SPAM requires a physical postal address and exposing a personal one
          is not acceptable. Distribution is the site + the Telegram channel.
          profiles.email_opt_in / dispatches.digest_sent_at remain as unused DB
          columns (not worth a migration). */}

      {/* Telegram invite — authenticated-only (PLAN §15.2). Two columns ≥sm (text +
          QR); stacked and centred on a phone. The QR carries the same invite URL. */}
      {telegramInvite ? (
        <div className="mt-8 rounded-lg border border-border p-4 sm:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="max-sm:text-center sm:flex-1">
              <p className="text-sm font-semibold text-text">{t("telegramTitle")}</p>
              <p className="mt-1 text-sm text-text-2">{t("telegramBody")}</p>
              <a
                href={telegramInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-on-primary transition-colors hover:bg-primary-hover"
              >
                {t("telegramJoin")}
              </a>
            </div>
            {telegramQr ? (
              <figure className="flex shrink-0 flex-col items-center gap-2 max-sm:self-center">
                {/* white plate gives the scanner its quiet zone in BOTH themes */}
                <div
                  role="img"
                  aria-label={t("telegramQrAlt")}
                  className="rounded-md bg-white p-3 [&>svg]:block [&>svg]:h-32 [&>svg]:w-32"
                  dangerouslySetInnerHTML={{ __html: telegramQr }}
                />
                <figcaption className="label-mono text-muted">{t("telegramScan")}</figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* MCP "Connect your agent" card (PLAN §15.10) — deliberately on the SAME
          screen as the Telegram card above: the token mint moment is when the
          user's attention is here, so both delivery channels convert together. */}
      <AgentTokensCard
        tokens={agentTokens}
        todayUtc={todayUtc}
        labels={{
          title: t("agentTitle"),
          body: t("agentBody"),
          mint: t("agentMint"),
          mintedNote: t("agentMintedNote"),
          tokenLabel: t("agentTokenLabel"),
          active: t("agentActive"),
          revoke: t("agentRevoke"),
          usedToday: t("agentUsedToday"),
          limitError: t("agentLimitError"),
          genericError: t("agentGenericError"),
          docsLink: t("agentDocsLink"),
          empty: t("agentEmpty"),
        }}
      />

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
