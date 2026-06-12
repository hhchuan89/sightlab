import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "../AuthForm";
import { signUp } from "../actions";

export default async function SignupPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-col gap-6">
      <AuthForm mode="signup" action={signUp} />
      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-accent hover:underline">
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
