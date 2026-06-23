import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";

/**
 * Marketing shell — same shared masthead + colophon as the reader shell, only the
 * wordmark variant (B, with tagline) and the nav set differ. /pricing stays out of
 * the nav (PLAN §15.7 — content is open & free).
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const items = [
    { href: "/dispatch", label: t("dispatch") },
    { href: "/paper", label: t("paper") },
    { href: "/login", label: t("login") },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="B" items={items} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
