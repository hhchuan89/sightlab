import Link from "next/link";

/**
 * §15.9 market-structure deep-read.
 *
 * The `teaser` is PUBLIC — shown to everyone. The full `body` is LOGIN-GATED: the
 * page passes `body` in ONLY for an authenticated user; for an anon request `body`
 * is `null`, so the real text is NEVER serialized into the (logged-out) client
 * payload. The body itself is pure market commentary (no holdings); the gate is a
 * distribution choice (PLAN §15.9), distinct from the §15.4 holdings invariant.
 *
 * The locked state is an HONEST "members continue" invitation — real, legible copy
 * in a card that grows with its content (no fixed height, no absolute overlay, so
 * it can never clip on a narrow phone). It deliberately does NOT fake hidden text
 * behind a blur: the old blurred-skeleton-plus-overlay read as broken/cut-off on
 * mobile and as a dark-pattern tease, both at odds with the brand's calm,
 * evidence-first voice.
 *
 * Presentational only: already-resolved label strings, no data fetching.
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
    reassure: string;
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
            <p key={i} className="font-body leading-relaxed text-text">
              {para}
            </p>
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-2 max-w-xl rounded-md border border-border bg-surface/50 px-6 py-8 text-center sm:px-10">
          <hr className="rule-amber mx-auto mb-5 w-10" />
          <h3 className="font-serif text-xl font-semibold text-text">{labels.lockedTitle}</h3>
          <p className="mx-auto mt-3 max-w-md font-body text-md leading-relaxed text-text-2">
            {labels.lockedBody}
          </p>
          <Link
            href={labels.ctaHref}
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-on-primary transition-colors hover:bg-primary-hover"
          >
            {labels.cta}
          </Link>
          <p className="label-mono mt-4 text-muted">{labels.reassure}</p>
        </div>
      )}
    </section>
  );
}
