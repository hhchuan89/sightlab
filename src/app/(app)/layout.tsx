import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";

/**
 * App shell for the reader surface (PLAN §2 tree, §6.1): the shared masthead +
 * colophon wrap /dispatch, /archive, /account. The reader shell now has a footer
 * (it didn't before) via the shared <SiteFooter/>.
 *
 * Nav tail is AUTH-AWARE (same fix as the marketing shell): 账户 when signed in,
 * 登录 when not — the two shells can no longer disagree about who you are.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("nav");
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const items = [
    { href: "/dispatch", label: t("dispatch") },
    { href: "/paper", label: t("paper") },
    { href: "/archive", label: t("archive") },
    { href: "/connect", label: t("connect") },
    session ? { href: "/account", label: t("account") } : { href: "/login", label: t("login") },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="A" items={items} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
