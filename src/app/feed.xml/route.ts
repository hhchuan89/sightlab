import { listHistory } from "@/lib/dispatch/queries";

/**
 * GET /feed.xml — Atom feed of the dispatch archive (agent-access Phase 0,
 * PLAN §15.10 discovery layer). Reads the same public RPC as the archive page
 * (metadata only: date + intro in both languages); entries link to the dated
 * dispatch page. No auth — dispatch content is public (PLAN §15.1).
 *
 * Cached at the CDN for 15 minutes: the feed changes once per day, so
 * freshness within minutes of the 00:05 UTC publish is not load-bearing.
 */
export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sightlab.fysight.biz").replace(
  /\/$/,
  "",
);

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET() {
  let rows;
  try {
    rows = await listHistory(30, 0);
  } catch (err) {
    console.error(`feed: listHistory failed: ${err instanceof Error ? err.message : String(err)}`);
    return new Response("feed temporarily unavailable", { status: 503 });
  }

  const updated = rows[0] ? `${rows[0].dispatch_date}T01:00:00Z` : new Date().toISOString();
  const entries = rows
    .map((r) => {
      const url = `${SITE}/dispatch/${r.dispatch_date}`;
      const title = `SightLab Dispatch ${r.dispatch_date}`;
      const summary = [r.intro_en, r.intro_zh].filter(Boolean).join("\n\n");
      return `  <entry>
    <title>${esc(title)}</title>
    <link href="${esc(url)}"/>
    <id>${esc(url)}</id>
    <updated>${r.dispatch_date}T01:00:00Z</updated>
    <summary>${esc(summary)}</summary>
  </entry>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>SightLab — Daily Market-Cycle Dispatch</title>
  <subtitle>Deterministic fund-flow and cycle-positioning reads. A confirmer, not a predictor. Research, not investment advice.</subtitle>
  <link href="${SITE}/feed.xml" rel="self"/>
  <link href="${SITE}/dispatch"/>
  <id>${SITE}/feed.xml</id>
  <updated>${updated}</updated>
${entries}
</feed>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
