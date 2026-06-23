import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";

/**
 * App shell for the reader surface (PLAN §2 tree, §6.1): the shared masthead +
 * colophon wrap /dispatch, /archive, /account. The reader shell now has a footer
 * (it didn't before) via the shared <SiteFooter/>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const items = [
    { href: "/dispatch", label: t("dispatch") },
    { href: "/paper", label: t("paper") },
    { href: "/archive", label: t("archive") },
    { href: "/account", label: t("account") },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader variant="A" items={items} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
