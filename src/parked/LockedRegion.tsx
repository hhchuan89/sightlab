import Link from "next/link";

/**
 * PARKED (PLAN §15) — unused since the v3 free/open pivot; kept for a possible
 * future paid tier. Not imported by any app code.
 *
 * Paywall region (PLAN §4.4, §6.4) — a blurred SKELETON over which a gradient +
 * upsell CTA sits.
 *
 * It takes ZERO data props on purpose: there is literally nothing real to leak,
 * because the paid bytes were never serialized to a non-paid client (the RPC
 * omitted the columns). The blur is enhancement, NOT the security boundary.
 *
 * Only presentational labels (a heading + CTA text + href) are passed in — all
 * UI strings, no dispatch data.
 */
export function LockedRegion({
  heading,
  body,
  ctaLabel,
  ctaHref = "/pricing",
}: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-border">
      {/* decorative blurred skeleton — static shapes, no data */}
      <div
        aria-hidden
        className="pointer-events-none select-none blur-sm"
        style={{ filter: "blur(6px)" }}
      >
        <div className="space-y-3 p-6">
          <div className="h-3 w-40 rounded bg-surface-2" />
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="h-4 rounded bg-surface-2"
                style={{ opacity: 0.5 + ((i * 7) % 5) / 10 }}
              />
            ))}
          </div>
          <div className="h-3 w-3/4 rounded bg-surface-2" />
          <div className="h-3 w-2/3 rounded bg-surface-2" />
          <div className="h-3 w-1/2 rounded bg-surface-2" />
        </div>
      </div>

      {/* gradient fade from the page bg up over the skeleton */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/30" />

      {/* upsell — the only real content here */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="article-tag">{"// "}LOCKED</span>
        <h3 className="font-serif text-2xl font-semibold text-text">{heading}</h3>
        <p className="max-w-md text-sm leading-relaxed text-text-2">{body}</p>
        <Link
          href={ctaHref}
          className="mt-1 inline-block rounded-full bg-primary px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-primary-hover"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
