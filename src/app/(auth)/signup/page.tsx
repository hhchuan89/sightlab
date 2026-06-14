import { redirect } from "next/navigation";

/** Auth is now magic-link only — /signup is folded into /login. Kept so old
 * links keep working. */
export default function SignupPage() {
  redirect("/login");
}
