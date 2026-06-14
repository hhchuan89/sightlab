import { getTranslations } from "next-intl/server";
import { AuthForm } from "../AuthForm";
import { sendMagicLink } from "../actions";

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
      <AuthForm action={sendMagicLink} notice={notice} />
    </div>
  );
}
