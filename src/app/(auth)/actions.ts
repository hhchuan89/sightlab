"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | null;

/**
 * Passwordless sign-in via magic link (Supabase OTP email). One action serves
 * both new and returning users: `shouldCreateUser: true` creates the account on
 * first use, and the handle_new_user trigger creates the profiles row (role
 * 'free') on insert. No session exists yet — the user clicks the emailed link,
 * which lands on /auth/callback to exchangeCodeForSession — so we surface a
 * "check your email" state rather than redirecting into a session.
 */
export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "auth.errors.missingEmail" };
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/account`, shouldCreateUser: true },
  });
  if (error) return { error: "auth.errors.magicLinkFailed" };
  redirect("/login?check_email=1");
}

/** Sign out and return to the landing page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
