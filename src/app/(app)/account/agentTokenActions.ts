"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * MCP personal-token lifecycle (agent-access Phase 1, PLAN §15.10).
 *
 * Everything runs on the user's OWN rows through the cookie-bound client — RLS
 * in force, no admin client anywhere. The plaintext token exists exactly once:
 * in the return value of createAgentToken (shown once in the UI); only its
 * SHA-256 lands in the DB. Revoke = set revoked_at (audit trail, no delete).
 */

const MAX_ACTIVE_TOKENS = 3;

export interface CreateTokenState {
  token?: string;
  error?: "not_authenticated" | "limit" | "db";
}

export async function createAgentToken(
  _prev: CreateTokenState,
  _formData: FormData,
): Promise<CreateTokenState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { count, error: countErr } = await supabase
    .from("agent_tokens")
    .select("id", { count: "exact", head: true })
    .is("revoked_at", null);
  if (countErr) return { error: "db" };
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) return { error: "limit" };

  const token = `slk_${randomBytes(32).toString("base64url")}`;
  const { error } = await supabase.from("agent_tokens").insert({
    user_id: user.id,
    token_hash: createHash("sha256").update(token).digest("hex"),
    last4: token.slice(-4),
  });
  if (error) return { error: "db" };

  revalidatePath("/account");
  return { token };
}

export async function revokeAgentToken(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  // RLS scopes the update to the caller's own rows.
  await supabase.from("agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/account");
}
