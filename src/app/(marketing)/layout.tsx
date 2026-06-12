import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LangToggle } from "@/components/i18n/LangToggle";

function MarketingHeader() {
  const t = useTranslations("nav");
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="shrink-0">
          <Wordmark variant="B" />
        </Link>
        <nav className="flex items-center gap-5">
          {/* /pricing removed from nav (PLAN §15.7) — content is open & free.
              The pricing page file stays in the repo as parked. */}
          <Link
            href="/dispatch"
            className="label-mono text-text-2 transition-colors hover:text-accent"
          >
            {t("dispatch")}
          </Link>
          <Link
            href="/paper"
            className="label-mono hidden text-text-2 transition-colors hover:text-accent sm:inline"
          >
            {t("paper")}
          </Link>
          <Link
            href="/login"
            className="label-mono hidden text-text-2 transition-colors hover:text-accent sm:inline"
          >
            {t("login")}
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}

function MarketingFooter() {
  const t = useTranslations("footer");
  const year = new Date().getUTCFullYear();
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-muted">
        <p className="editorial-quote text-sm not-italic">{t("disclaimer")}</p>
        <div className="flex items-center gap-2">
          <Wordmark variant="C" />
          <span className="label-mono text-muted">
            © {year} · {t("rights")}
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
