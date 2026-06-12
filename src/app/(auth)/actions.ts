"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | null;

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

/**
 * Email + password sign-in. On success the Supabase client writes the session
 * cookies; we revalidate and redirect to /account. Returns an error string for
 * the form to display on failure (useFormState-compatible signature).
 */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "auth.errors.missingFields" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "auth.errors.invalidCredentials" };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

/**
 * Email + password sign-up. With email confirmation ON (PLAN §14-C9), Supabase
 * sends a confirm link and does NOT create a session yet; we surface a
 * "check your email" state rather than redirecting into an unconfirmed session.
 * The handle_new_user trigger creates the profiles row (role 'free') on insert.
 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "auth.errors.missingFields" };
  }
  if (password.length < 8) {
    return { error: "auth.errors.weakPassword" };
  }

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    return { error: "auth.errors.signupFailed" };
  }

  // If confirmation is required, there is no active session yet → tell the user
  // to check their email. (Supabase returns a user with no session in that case.)
  if (data.user && !data.session) {
    redirect("/login?check_email=1");
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

/** Sign out and return to the landing page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
