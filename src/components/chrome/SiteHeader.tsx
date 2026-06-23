import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { GitHubLink } from "@/components/brand/GitHubLink";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LangToggle } from "@/components/i18n/LangToggle";
import { NavLinks } from "@/components/chrome/NavLinks";

/**
 * The ONE shared masthead for every shell (reader + marketing). Replaces the two
 * near-duplicate headers that had drifted (different links, and a logo that wrongly
 * pointed at /dispatch in the reader shell). Responsive by design:
 *
 *  • < sm  — two rows: a brand row (wordmark left, icon controls right) over a
 *            horizontally-scrollable nav rail. Every link keeps a 44px tap target
 *            and nothing wraps or gets hidden (the old `hidden sm:inline` had been
 *            HIDING Method/Archive on phones — broken nav, worse than crammed).
 *  • ≥ sm  — the familiar single row: wordmark · nav · divider · GitHub · lang · theme.
 *
 * The wordmark ALWAYS links home ("/") — one source of truth, can never drift again.
 * Server component; NavLinks (usePathname) is the only client island.
 */
export function SiteHeader({
  variant,
  items,
}: {
  variant: "A" | "B";
  items: { href: string; label: string }[];
}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-5xl px-5">
        {/* brand row */}
        <div className="flex items-center justify-between gap-4 py-4">
          <Link href="/" aria-label="SightLab" className="shrink-0">
            <Wordmark variant={variant} />
          </Link>

          {/* ≥sm: nav + controls inline */}
          <div className="hidden items-center gap-6 sm:flex">
            <nav aria-label="Primary" className="flex items-center gap-6">
              <NavLinks items={items} />
            </nav>
            <span className="h-4 w-px bg-border" aria-hidden />
            <GitHubLink />
            <LangToggle />
            <ThemeToggle />
          </div>

          {/* <sm: controls only (nav drops to the rail below) */}
          <div className="flex items-center gap-2 sm:hidden">
            <GitHubLink />
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* <sm: scrollable nav rail — all links reachable, none hidden */}
        <nav
          aria-label="Primary"
          className="nav-rail -mx-5 flex gap-6 overflow-x-auto border-t border-border px-5 py-2.5 sm:hidden"
        >
          <NavLinks items={items} />
        </nav>
      </div>
    </header>
  );
}
