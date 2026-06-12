import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/getSession";
import { CheckoutButton } from "./CheckoutButton";

/**
 * PARKED (PLAN §15) — v3 is free/open, so this page was moved out of the route
 * tree (src/app/(marketing)/pricing → src/parked/pricing). It is NOT routable
 * and must not be imported from app code; it stays only for a possible future
 * paid tier.
 */
export const metadata: Metadata = {
  title: "Pricing",
};

// Resolves the session per-request to decide signed-in vs signed-out CTA.
export const dynamic = "force-dynamic";

function PlanCard({
  name,
  price,
  period,
  badge,
  features,
  children,
}: {
  name: string;
  price: string;
  period: string;
  badge?: string;
  features: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-surface p-7">
      <div className="flex items-baseline justify-between">
        <span className="article-tag">{`// ${name}`}</span>
        {badge ? (
          <span className="label-mono rounded-full bg-primary-soft px-2.5 py-1 text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-serif text-5xl font-semibold text-text">{price}</span>
        <span className="label-mono text-muted">{period}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-text-2">
            <span className="mt-1 text-primary" aria-hidden>
              ·
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const { user } = await getSession();
  const signedIn = user !== null;
  const features = [t("feature1"), t("feature2"), t("feature3"), t("feature4")];

  return (
    <div className="mx-auto max-w-5xl px-5 pt-12">
      <span className="article-tag">{`// ${t("title")}`}</span>
      <hr className="rule-ink mt-3" />
      <h1 className="mt-8 text-5xl font-semibold text-text">{t("title")}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-2">{t("standfirst")}</p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <PlanCard
          name={t("monthlyName")}
          price={t("monthlyPrice")}
          period={t("monthlyPeriod")}
          features={features}
        >
          <CheckoutButton plan="monthly" label={t("subscribe")} signedIn={signedIn} />
        </PlanCard>
        <PlanCard
          name={t("yearlyName")}
          price={t("yearlyPrice")}
          period={t("yearlyPeriod")}
          badge={t("yearlySave")}
          features={features}
        >
          <CheckoutButton plan="yearly" label={t("subscribe")} signedIn={signedIn} />
        </PlanCard>
      </div>

      {/* Delivery-expectation note — PLAN §14-M4: a late day is a known
          property, not a broken promise. Keep this on the pricing page. */}
      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">{t("deliveryNote")}</p>
    </div>
  );
}
