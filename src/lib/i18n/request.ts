import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "zh";
}

/**
 * Resolve the active locale from the `locale` cookie (no /[locale] segment —
 * the toggle is a reading preference, see PLAN §6.2). Falls back to `en`.
 */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  return isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return { locale, messages };
});
