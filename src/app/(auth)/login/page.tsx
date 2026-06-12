import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "../AuthForm";
import { signIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check_email?: string; auth_error?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth");

  const notice = params.check_email
    ? t("checkEmail")
    : params.auth_error
      ? t("errors.callbackFailed")
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <AuthForm mode="signin" action={signIn} notice={notice} />
      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-accent hover:underline">
          {t("signUpLink")}
        </Link>
      </p>
    </div>
  );
}
