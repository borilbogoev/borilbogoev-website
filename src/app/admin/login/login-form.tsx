"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginWithPassword, type LoginState } from "@/modules/auth/actions";

const ERRORS: Record<string, string> = {
  not_allowed: "This Google account has no access. Ask an admin to add you.",
  google_failed: "Google sign-in failed. Please try again.",
  google_not_configured: "Google sign-in is not set up yet.",
};

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const [state, action, pending] = useActionState<LoginState, FormData>(loginWithPassword, {});
  const error = state.error ?? ERRORS[params.get("error") ?? ""];

  return (
    <div className="bbfa-login__form">
      {error ? (
        <p role="alert" className="bbfa-login__error">
          {error}
        </p>
      ) : null}
      {googleEnabled ? (
        <>
          <a className="bbfa-btn bbfa-btn--ghost" href={`/api/admin/auth/google?next=${encodeURIComponent(next)}`}>
            Continue with Google
          </a>
          <div className="bbfa-login__or">
            <span />
            or
            <span />
          </div>
        </>
      ) : null}
      <form action={action} className="bbfa-login__fields">
        <input type="hidden" name="next" value={next} />
        <label className="bbfa-field">
          <span className="bbfa-label">Email</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="bbfa-field">
          <span className="bbfa-label">Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={pending} className={`bbfa-btn${pending ? " is-loading" : ""}`}>
          {pending ? "Signing in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
