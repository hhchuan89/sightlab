import Link from "next/link";

/**
 * §15.9 market-structure deep-read.
 *
 * The `teaser` is PUBLIC — shown to everyone. The full `body` is LOGIN-GATED: the
 * page passes `body` in ONLY for an authenticated user; for an anon request `body`
 * is `null`, so the real text is NEVER serialized into the (logged-out) client
 * payload. The blur skeleton below is a decorative placeholder with NO real data —
 * it is the visual, not the security boundary (mirrors the parked LockedRegion's
 * design). The body itself is pure market commentary (no holdings); the gate is a
 * distribution choice (PLAN §15.9), distinct from the §15.4 holdings invariant.
 *
 * Presentational only: it receives already-resolved label strings (like the other
 * dispatch section components), no data fetching.
 */
export function DeepReadSection({
  teaser,
  body,
  labels,
}: {
  teaser: string;
  body: string | null;
  labels: {
    tag: string;
    title: string;
    lockedTitle: string;
    lockedBody: string;
    cta: string;
    ctaHref: string;
  };
}) {
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <span className="article-tag">
        {"// "}
        {labels.tag}
      </span>
      <h2 className="font-serif text-2xl font-semibold text-text">{labels.title}</h2>

      {teaser ? (
        <p className="font-body text-lg leading-relaxed text-text prose-measure">{teaser}</p>
      ) : null}

      {body !== null ? (
        <div className="space-y-4 prose-measure">
          {body.split("\n\n").map((para, i) => (
            <p key={i} className="font-body leading-relaxed text-text-2">
              {para}
            </p>
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-md border border-border">
          {/* decorative blurred skeleton — static shapes, NO real data is passed here */}
          <div
            aria-hidden
            className="pointer-events-none select-none"
            style={{ filter: "blur(6px)" }}
          >
            <div className="space-y-3 p-6">
              <div className="h-3 w-2/3 rounded bg-surface-2" />
              <div className="h-3 w-full rounded bg-surface-2" />
              <div className="h-3 w-5/6 rounded bg-surface-2" />
              <div className="h-3 w-3/4 rounded bg-surface-2" />
              <div className="h-3 w-4/5 rounded bg-surface-2" />
            </div>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <h3 className="font-serif text-xl font-semibold text-text">{labels.lockedTitle}</h3>
            <p className="max-w-md text-sm leading-relaxed text-text-2">{labels.lockedBody}</p>
            <Link
              href={labels.ctaHref}
              className="mt-1 inline-block rounded-full bg-primary px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-primary-hover"
            >
              {labels.cta}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
