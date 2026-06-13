import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProtectedReader } from "@/components/paper/ProtectedReader";
import { PaperDraft } from "@/components/paper/PaperDraft";
import { getSession } from "@/lib/auth/getSession";

/**
 * /paper — the methodology paper, GATED behind a free login (PLAN §9, §15.7).
 *
 * Reads the session, so the route is dynamic (not statically cached). Anonymous
 * visitors get a short standfirst + a "log in to read" gate; signed-in users get
 * the full paper inside <ProtectedReader> (copy-discouragement + the honest
 * screenshot caveat remain the real boundary, §9/§14-C10). Login is FREE — the
 * gate is a distribution incentive, not a paywall.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How SightLab reads the cycle: §6 fund-flow accumulation/distribution, §7 Weinstein staging + the 30-week SMA + sector dispersion, and the confirmer-not-predictor framing. A draft.",
};

export default async function PaperPage() {
  const { user } = await getSession();
  const t = await getTranslations("paper");

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-5 pt-16 pb-24">
        <span className="article-tag">{`// ${t("gateKicker")}`}</span>
        <h1 className="mt-4 text-4xl font-semibold text-text">{t("gateTitle")}</h1>
        <p className="mt-6 text-lg leading-relaxed text-text-2">{t("gateBody")}</p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-primary px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-text transition-colors hover:bg-primary-hover"
          >
            {t("gateLoginCta")}
          </Link>
          <Link
            href="/signup"
            className="label-mono text-text-2 underline decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          >
            {t("gateSignupCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProtectedReader>
      <PaperDraft />
    </ProtectedReader>
  );
}
