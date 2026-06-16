import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/Wordmark";
import { GitHubLink } from "@/components/brand/GitHubLink";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LangToggle } from "@/components/i18n/LangToggle";

/**
 * App shell for the signed-in / reader surface (PLAN §2 tree, §6.1): SightLab
 * wordmark + theme + lang toggles. Wraps /dispatch, /archive, /account.
 */
function AppHeader() {
  const t = useTranslations("nav");
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/dispatch" className="shrink-0" aria-label="SightLab">
          <Wordmark variant="A" />
        </Link>
        <nav className="flex items-center gap-5">
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
            href="/archive"
            className="label-mono hidden text-text-2 transition-colors hover:text-accent sm:inline"
          >
            {t("archive")}
          </Link>
          <Link
            href="/account"
            className="label-mono text-text-2 transition-colors hover:text-accent"
          >
            {t("account")}
          </Link>
          <GitHubLink />
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
