"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Toggle the signed-in user's daily-email opt-in (PLAN §15.2).
 *
 * Writes `profiles.email_opt_in` on the user's OWN row via the cookie-bound
 * client (RLS in force, `auth.uid()` keys the row). The desired value is passed
 * as a hidden form field so the action is a plain submit, no client JS needed.
 */
export async function setEmailOptIn(formData: FormData): Promise<void> {
  const optIn = formData.get("opt_in") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ email_opt_in: optIn }).eq("id", user.id);

  revalidatePath("/account");
}
