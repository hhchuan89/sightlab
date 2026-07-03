"use client";

import { useActionState } from "react";
import { createAgentToken, revokeAgentToken, type CreateTokenState } from "./agentTokenActions";

/**
 * "Connect your agent" card (agent-access Phase 1, PLAN §15.10) — mint/revoke
 * MCP personal tokens. Client island because the freshly-minted plaintext
 * token must live ONLY in component state (shown once, never in a URL or the
 * DB). Labels arrive pre-translated from the server page (NavLinks
 * convention: dumb presentational client component, no i18n coupling).
 */

export interface AgentTokenRow {
  id: string;
  last4: string;
  created_at: string;
  day_count: number;
  day_date: string | null;
}

export interface AgentTokenLabels {
  title: string;
  body: string;
  mint: string;
  mintedNote: string;
  tokenLabel: string;
  active: string;
  revoke: string;
  usedToday: string;
  limitError: string;
  genericError: string;
  docsLink: string;
  empty: string;
}

export function AgentTokensCard({
  tokens,
  labels,
  todayUtc,
}: {
  tokens: AgentTokenRow[];
  labels: AgentTokenLabels;
  /** server-computed UTC date, so "used today" never trusts the client clock. */
  todayUtc: string;
}) {
  const [state, formAction, pending] = useActionState<CreateTokenState, FormData>(
    createAgentToken,
    {},
  );

  return (
    <div className="mt-8 rounded-lg border border-border p-4 sm:p-5">
      <p className="text-sm font-semibold text-text">{labels.title}</p>
      <p className="mt-1 text-sm text-text-2">{labels.body}</p>
      <a href="/connect" className="mt-1 inline-block label-mono text-accent-text hover:underline">
        {labels.docsLink}
      </a>

      {tokens.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{labels.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="font-mono text-sm text-text">
                slk_…{t.last4}
                <span className="ml-3 label-mono text-muted">
                  {labels.usedToday} {t.day_date === todayUtc ? t.day_count : 0}/30
                </span>
              </span>
              <form action={revokeAgentToken}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-text-2 transition-colors hover:border-danger hover:text-danger"
                >
                  {labels.revoke}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {labels.mint}
        </button>
      </form>

      {state.token ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-4">
          <p className="label-mono text-muted">{labels.tokenLabel}</p>
          <code className="mt-2 block overflow-x-auto font-mono text-sm text-text select-all">
            {state.token}
          </code>
          <p className="mt-2 text-xs text-muted">{labels.mintedNote}</p>
        </div>
      ) : null}
      {state.error === "limit" ? (
        <p className="mt-3 text-sm text-danger">{labels.limitError}</p>
      ) : null}
      {state.error === "db" || state.error === "not_authenticated" ? (
        <p className="mt-3 text-sm text-danger">{labels.genericError}</p>
      ) : null}
    </div>
  );
}
