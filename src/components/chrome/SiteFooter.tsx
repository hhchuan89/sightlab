import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * The ONE shared colophon. Previously only the marketing layout had a footer, so
 * the reader pages (/dispatch, /archive, /account) shipped with NO footer at all —
 * and the load-bearing disclaimer ("research, not investment advice; a confirmer,
 * not a predictor") never reached the pages people actually read. This single
 * component, rendered by both shells, fixes that and can never drift again.
 *
 * Carries only brand/legal content — zero user/holdings data — so it is safe on
 * the gated reader shell. On a phone the colophon CENTERS (it's standalone chrome,
 * not running prose), so it reads as a deliberate sign-off rather than a scrap
 * left-shoved in the gutter.
 */
export function SiteFooter() {
  const t = useTranslations("footer");
  const year = new Date().getUTCFullYear();
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10 text-sm text-muted max-sm:items-center max-sm:text-center">
        <p className="editorial-quote font-body text-md not-italic text-text-2 max-w-2xl max-sm:border-l-0 max-sm:pl-0">
          {t("disclaimer")}
        </p>
        <hr className="rule-hair w-full" />
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <Wordmark variant="C" />
            <span className="label-mono text-muted">
              © {year} · {t("rights")}
            </span>
          </div>
          <a
            href="https://github.com/hhchuan89/sightlab"
            target="_blank"
            rel="noopener noreferrer"
            className="label-mono text-muted transition-colors hover:text-accent"
          >
            {t("openSource")}
          </a>
        </div>
      </div>
    </footer>
  );
}
