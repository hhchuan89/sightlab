"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { AuthState } from "./actions";

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
 * Passwordless sign-in form for /login. Drives the sendMagicLink server action
 * through useActionState; error keys returned by the action are resolved against
 * the `auth` message namespace. One email field — no password, no signin/signup
 * distinction (Supabase OTP creates the account on first use).
 */
export function AuthForm({
  action,
  notice,
  next,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  notice?: string;
  /** post-login destination, threaded to the action so it can build the magic-link redirect. */
  next?: string;
}) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState<AuthState, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/account"} />
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-2xl font-semibold text-text">{t("signInTitle")}</h1>
        <p className="text-sm text-muted">{t("magicLinkSubtitle")}</p>
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

      {state?.error ? (
        <p className="text-sm text-danger" role="alert">
          {/* action returns a message key under the `auth` namespace */}
          {t(state.error.replace(/^auth\./, ""))}
        </p>
      ) : null}

      <SubmitButton label={t("signInButton")} />
    </form>
  );
}
