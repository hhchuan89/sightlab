"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

const LOCALE_COOKIE = "locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Two-state locale pill. The locale is a reading preference (cookie, no
 * /[locale] segment per §6.2): flip the cookie, then router.refresh() so the
 * server re-renders with the new messages + content language.
 */
export function LangToggle() {
  const t = useTranslations("toggle");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function flip() {
    const next = locale === "en" ? "zh" : "en";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      aria-label={t("lang")}
      className="label-mono rounded-full border border-border px-3 py-1.5 text-text-2 transition-colors hover:border-primary hover:text-accent disabled:opacity-50"
    >
      {t("lang")}
    </button>
  );
}
