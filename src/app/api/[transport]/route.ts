import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";

/**
 * /api/mcp — SightLab's MCP server (agent-access Phase 1, PLAN §15.10).
 *
 * READ-ONLY BY CONSTRUCTION: the four tools below are the complete tool set —
 * no write tool exists — and this route holds ONLY the public anon key. All
 * data flows through the same public RPCs the site renders from, so boundary
 * decisions (e.g. migration 0008's formula-internals strip) apply here
 * automatically. The only reachable write anywhere is "increment my own daily
 * counter" inside the SECURITY DEFINER rate-limit function (migration 0009).
 *
 * Auth: personal bearer token (minted on /account, stored as SHA-256).
 * - verifyToken (per HTTP request): validity only — protocol overhead like
 *   initialize/tools-list does NOT consume quota.
 * - Each TOOL CALL passes through mcp_use_token: authenticate + count one
 *   call, default 30/day/token (SIGHTLAB_MCP_DAILY_LIMIT overrides).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const DAILY_LIMIT = Number(process.env.SIGHTLAB_MCP_DAILY_LIMIT ?? 30);

// Plain anon client — a machine endpoint has no cookies/session by design.
const anon = () => createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function jsonContent(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function errContent(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/** Authenticate + count ONE tool call. Returns an error payload or null (= proceed). */
async function spendCall(authInfo: AuthInfo | undefined) {
  const token = authInfo?.token;
  if (!token) return errContent("missing token — mint one on https://sightlab.fysight.biz/account");
  const { data, error } = await anon().rpc("mcp_use_token", {
    p_token_hash: sha256(token),
    p_daily_limit: DAILY_LIMIT,
  });
  if (error) return errContent(`rate-limit check unavailable: ${error.message}`);
  const res = data as { ok: boolean; reason?: string; resets_utc?: string; remaining?: number };
  if (!res.ok) {
    if (res.reason === "rate_limited") {
      return errContent(
        `daily limit of ${DAILY_LIMIT} tool calls reached for this token; resets ${res.resets_utc} 00:00 UTC`,
      );
    }
    return errContent(
      "invalid or revoked token — manage tokens on https://sightlab.fysight.biz/account",
    );
  }
  return null;
}

const READING_RULES = `SightLab reading rules (they bind every consumer, agents included):
- The cycle read is a CONFIRMER, NOT A PREDICTOR. It describes the present regime and cannot call turning points. Never present it as a forecast.
- Numbers are deterministic engine output. Quote them verbatim; never re-round or restate.
- Fund-flow A/D signals are volume-price INFERENCE, not real fund-flow data. Only "strong" signals carry conclusions; "weak" ones are context.
- Two ladders: the page-top cycle read uses Templeton PHASES (Phase 3 = optimism); the sector table uses Weinstein STAGES (Stage 3 = topping pattern). Same numbers, different meanings.
- FIELD-NAMING CAVEAT: the STRUCTURED enum fields (cycle_badge.templeton_stage, composite.templeton_stage, hysteresis_smoothed_stage, implied_stage) carry legacy strings like "Stage 2/3 transition" / 「阶段 2/3 过渡」 — those are Templeton PHASES (data contract kept stable), NOT Weinstein sector stages. Prose fields already say "Phase"/「期」. When you present these enums to a human, render them as "Phase …".
- This is research, not investment advice.

Glossary (short):
- Weinstein Stage: S1 basing (flat 30-week MA) / S2 advance (rising MA, price above) / S3 top (MA flattens) / S4 decline (falling MA, price below).
- Distance: % of price above/below its 30-week simple moving average.
- Slope: how fast that MA itself is rising or falling (5-week basis).
- Sector dispersion: spread of sectors across stages/trend strength; high = narrowing leadership (late-cycle fragility flag).
- Accumulation/Distribution: persistent net buying/selling inferred from volume-price analysis; lags by design.
- Volume Δ%: this week's average daily volume vs the previous week's.
- Confidence: how consistently the evidence layers agree — coherence of the read, not probability of continuation.
- 中文对照: 期(Phase)=Templeton 情绪阶梯;阶段(Stage)=Weinstein 趋势阶梯;吸筹/派发=Accumulation/Distribution;置信度=Confidence。`;

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_latest_dispatch",
      {
        title: "Latest SightLab dispatch",
        description:
          "The most recent SightLab market dispatch (bilingual EN/中文): cycle badge, at-a-glance, weekly sector fund flows (§6), cycle positioning (§7) incl. supplementary reads, and the market-structure deep-read. Call get_method_glossary once first to interpret the enums correctly.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const spent = await spendCall(extra.authInfo);
        if (spent) return spent;
        const { data, error } = await anon().rpc("get_latest_public");
        if (error) return errContent(`upstream read failed: ${error.message}`);
        return jsonContent(data);
      },
    );

    server.registerTool(
      "get_dispatch",
      {
        title: "SightLab dispatch by date",
        description:
          "One archived SightLab dispatch by date (YYYY-MM-DD). Same shape as get_latest_dispatch. Returns null when that date has no edition (weekends before launch, Monday rest days).",
        inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
      },
      async ({ date }, extra) => {
        const spent = await spendCall(extra.authInfo);
        if (spent) return spent;
        const { data, error } = await anon().rpc("get_dispatch_public", { p_slug: date });
        if (error) return errContent(`upstream read failed: ${error.message}`);
        return jsonContent(data);
      },
    );

    server.registerTool(
      "list_archive",
      {
        title: "SightLab archive list",
        description:
          "Archive metadata, newest first: dispatch_date plus the bilingual intro line for each edition. Use get_dispatch for full content.",
        inputSchema: {
          limit: z.number().int().min(1).max(60).default(30),
          offset: z.number().int().min(0).default(0),
        },
      },
      async ({ limit, offset }, extra) => {
        const spent = await spendCall(extra.authInfo);
        if (spent) return spent;
        const { data, error } = await anon().rpc("list_dispatches_public", {
          p_limit: limit,
          p_offset: offset,
        });
        if (error) return errContent(`upstream read failed: ${error.message}`);
        return jsonContent(data);
      },
    );

    server.registerTool(
      "search_archive",
      {
        title: "Search the SightLab archive",
        description:
          "Text search across all dispatch content (intros, flow tables, cycle reads, deep-reads; EN and 中文). Returns METADATA matches only — dispatch_date plus the bilingual intro, newest first; follow up with get_dispatch(date) for full content. Query must be 2–100 characters.",
        inputSchema: {
          query: z.string().min(2).max(100),
          limit: z.number().int().min(1).max(30).default(10),
        },
      },
      async ({ query, limit }, extra) => {
        const spent = await spendCall(extra.authInfo);
        if (spent) return spent;
        const { data, error } = await anon().rpc("search_dispatches_public", {
          p_query: query,
          p_limit: limit,
        });
        if (error) return errContent(`upstream search failed: ${error.message}`);
        return jsonContent(data);
      },
    );

    server.registerTool(
      "get_method_glossary",
      {
        title: "SightLab method & reading rules",
        description:
          "How to read SightLab data: the confirmer-not-predictor rule, strong-vs-weak signal semantics, the two stage ladders, and the term glossary. Call this once per session before interpreting dispatch data.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const spent = await spendCall(extra.authInfo);
        if (spent) return spent;
        return { content: [{ type: "text" as const, text: READING_RULES }] };
      },
    );
  },
  {},
  { basePath: "/api", maxDuration: 60 },
);

// Per-request token validity (NOT counted — see module docstring).
const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken || !bearerToken.startsWith("slk_")) return undefined;
  const { data, error } = await anon().rpc("mcp_verify_token", {
    p_token_hash: sha256(bearerToken),
  });
  if (error) return undefined;
  const res = data as { ok: boolean; user_id?: string };
  if (!res.ok) return undefined;
  return {
    token: bearerToken,
    scopes: ["read"],
    clientId: res.user_id ?? "unknown",
  };
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST };
