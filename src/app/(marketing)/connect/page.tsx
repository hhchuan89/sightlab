import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * /connect — the agent-access guide (PLAN §15.10 Phase 0, decision §三-B).
 *
 * Documents the three access layers, cheapest first: Atom feed + llms.txt
 * (zero setup), the raw public JSON RPCs (the SAME read path the site uses —
 * the anon key printed below already ships in this page's own JS bundle, so
 * documenting it discloses nothing new), and the MCP server (Phase 1, spec
 * promises stated up front: read-only by construction, free token, 30 tool
 * calls/day). PUBLIC page — content is public (PLAN §15.1); the login carrot
 * is the MCP token, never the data.
 */

export const metadata: Metadata = { title: "For agents — SightLab" };

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-text-2">
      {children}
    </pre>
  );
}

export default async function ConnectPage() {
  const t = await getTranslations("connect");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sightlab.fysight.biz").replace(
    /\/$/,
    "",
  );
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://<project>.supabase.co"
  ).replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "<anon key>";

  const rpc = (fn: string, body: string) =>
    `curl -s -X POST "${supabaseUrl}/rest/v1/rpc/${fn}" \\
  -H "apikey: ${anonKey}" \\
  -H "Authorization: Bearer ${anonKey}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <span className="article-tag">{`// ${t("tag")}`}</span>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-text">{t("title")}</h1>
      <p className="mt-3 font-body text-lg leading-relaxed text-text-2 prose-measure">
        {t("standfirst")}
      </p>

      {/* ── layer 1: feed + llms.txt ── */}
      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold text-text">{t("layer1Title")}</h2>
        <p className="mt-2 font-body text-md leading-relaxed text-text-2 prose-measure">
          {t("layer1Body")}
        </p>
        <dl className="mt-3 space-y-1 font-mono text-sm">
          <div className="flex flex-wrap gap-x-3">
            <dt className="label-mono text-muted">{t("feedLabel")}</dt>
            <dd>
              <a className="text-accent-text hover:underline" href="/feed.xml">
                {site}/feed.xml
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-3">
            <dt className="label-mono text-muted">{t("llmsLabel")}</dt>
            <dd>
              <a className="text-accent-text hover:underline" href="/llms.txt">
                {site}/llms.txt
              </a>
            </dd>
          </div>
        </dl>
      </section>

      {/* ── layer 2: raw JSON RPCs ── */}
      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold text-text">{t("layer2Title")}</h2>
        <p className="mt-2 font-body text-md leading-relaxed text-text-2 prose-measure">
          {t("layer2Body")}
        </p>
        <p className="mt-4 label-mono text-muted">{t("layer2Latest")}</p>
        <CodeBlock>{rpc("get_latest_public", "{}")}</CodeBlock>
        <p className="mt-4 label-mono text-muted">{t("layer2ByDate")}</p>
        <CodeBlock>{rpc("get_dispatch_public", '{"p_slug": "2026-07-03"}')}</CodeBlock>
        <p className="mt-4 label-mono text-muted">{t("layer2List")}</p>
        <CodeBlock>{rpc("list_dispatches_public", '{"p_limit": 30, "p_offset": 0}')}</CodeBlock>
      </section>

      {/* ── layer 3: MCP (live — Phase 1) ── */}
      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold text-text">{t("layer3Title")}</h2>
        <p className="mt-2 font-body text-md leading-relaxed text-text-2 prose-measure">
          {t("layer3Body")}
        </p>
        <ul className="mt-3 space-y-2 font-body text-md leading-relaxed text-text-2">
          <li className="border-l border-border pl-4">{t("layer3Promise1")}</li>
          <li className="border-l border-border pl-4">{t("layer3Promise2")}</li>
          <li className="border-l border-border pl-4">{t("layer3Promise3")}</li>
        </ul>
        <p className="mt-5 label-mono text-muted">{t("layer3GetToken")}</p>
        <Link
          className="mt-1 inline-block font-mono text-sm text-accent-text hover:underline"
          href="/account"
        >
          {t("layer3AccountLink")}
        </Link>
        <p className="mt-4 label-mono text-muted">{t("layer3CfgClaudeCode")}</p>
        <CodeBlock>{`claude mcp add --transport http sightlab ${site}/api/mcp \\
  --header "Authorization: Bearer slk_YOUR_TOKEN"`}</CodeBlock>
        <p className="mt-4 label-mono text-muted">{t("layer3CfgUrl")}</p>
        <CodeBlock>{`{
  "mcpServers": {
    "sightlab": {
      "url": "${site}/api/mcp",
      "headers": { "Authorization": "Bearer slk_YOUR_TOKEN" }
    }
  }
}`}</CodeBlock>
        <p className="mt-4 label-mono text-muted">{t("layer3CfgStdio")}</p>
        <CodeBlock>{`{
  "mcpServers": {
    "sightlab": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${site}/api/mcp",
               "--header", "Authorization: Bearer slk_YOUR_TOKEN"]
    }
  }
}`}</CodeBlock>
        <p className="mt-3 text-xs text-muted">{t("layer3Drift")}</p>

        {/* Troubleshooting — every item below was hit in real first-user setup
            (2026-07-03): a CLI mangled the spaced header value into a bare
            token (401), and tools only appear after a session restart. */}
        <h3 className="mt-6 label-mono text-muted">{t("troubleTitle")}</h3>
        <ul className="mt-2 space-y-2 font-body text-sm leading-relaxed text-text-2">
          <li className="border-l border-border pl-4">{t("trouble401")}</li>
          <li className="border-l border-border pl-4">{t("troubleReload")}</li>
          <li className="border-l border-border pl-4">{t("troubleDate")}</li>
        </ul>
      </section>

      {/* ── reading rules ── */}
      <section className="mt-10 rounded-md border border-border bg-surface p-5">
        <h2 className="label-mono text-muted">{t("rulesTitle")}</h2>
        <p className="mt-2 font-body text-md leading-relaxed text-text-2 prose-measure">
          {t("rulesBody")}
        </p>
        <Link
          className="mt-3 inline-block label-mono text-accent-text hover:underline"
          href="/dispatch"
        >
          {t("glossaryLink")}
        </Link>
      </section>
    </div>
  );
}
