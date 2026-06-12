"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { AuthState } from "./actions";

type Mode = "signin" | "signup";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-primary-hover disabled:opacity-60"
    >
      {label}
    </button>
  );
}

/**
 * Shared email+password form for /login and /signup. Drives the signIn/signUp
 * server actions through useActionState; error keys returned by the action are
 * resolved against the `auth` message namespace.
 */
export function AuthForm({
  mode,
  action,
  notice,
}: {
  mode: Mode;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  notice?: string;
}) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState<AuthState, FormData>(action, null);

  const title = mode === "signin" ? t("signInTitle") : t("signUpTitle");
  const submitLabel = mode === "signin" ? t("signInButton") : t("signUpButton");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-2xl font-semibold text-text">{title}</h1>
        <p className="text-sm text-muted">
          {mode === "signin" ? t("signInSubtitle") : t("signUpSubtitle")}
        </p>
      </div>

      {notice ? (
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-2">
          {notice}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="label-mono text-text-2">{t("emailLabel")}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-mono text-text-2">{t("passwordLabel")}</span>
        <input
          type="password"
          name="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>

      {state?.error ? (
        <p className="text-sm text-danger" role="alert">
          {/* action returns a message key under the `auth` namespace */}
          {t(state.error.replace(/^auth\./, ""))}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
