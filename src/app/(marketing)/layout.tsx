import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";

/**
 * Marketing shell — same shared masthead + colophon as the reader shell, only the
 * wordmark variant (B, with tagline) and the nav set differ. /pricing stays out of
 * the nav (PLAN §15.7 — content is open & free).
 *
 * The nav tail is AUTH-AWARE (bug fix 2026-07-03: a signed-in user landing on /
 * saw 登录 while /account showed 账户 — the two shells disagreed about who you
 * are). Cookie-level getSession() only — cheap, no network; a stale cookie at
 * worst shows 账户 to a signed-out user, and middleware corrects on click.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("nav");
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const items = [
    { href: "/dispatch", label: t("dispatch") },
    { href: "/paper", label: t("paper") },
    { href: "/connect", label: t("connect") },
    session ? { href: "/account", label: t("account") } : { href: "/login", label: t("login") },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="B" items={items} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
