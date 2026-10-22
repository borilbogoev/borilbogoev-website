"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { loginWithPassword, type LoginState } from "@/modules/auth/actions";
import { api } from "./client-api";
import "./classroom.css";

const ERRORS: Record<string, string> = {
  link_expired: "That link has expired or was already used. Ask for a new one below.",
  disabled: "This account is disabled. Contact us if this is a mistake.",
  signup_closed: "New accounts are closed right now. Ask for an invitation.",
  failed: "Sign-in failed. Please try again.",
  not_allowed: "No account matches this Google address, and new accounts are closed.",
  google_failed: "Google sign-in failed. Please try again.",
};

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const raw = params.get("next") ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/classroom/my";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(ERRORS[params.get("error") ?? ""] ?? "");
  const [pw, pwAction, pwPending] = useActionState<LoginState, FormData>(loginWithPassword, {});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("auth/link", { body: { email, name, next } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="cr-signin card" role="status">
        <p className="eyebrow">Check your email</p>
        <h2 className="t-h2 mt-2">The link is on its way.</h2>
        <p className="t-body-sm mt-3">
          If <strong>{email}</strong> can sign in, you will get an email in a minute. The link works for 20 minutes. Check the spam folder if you do not see it.
        </p>
        <button type="button" className="cr-link mt-4" onClick={() => setSent(false)}>
          Use another address
        </button>
      </div>
    );
  }

  return (
    <div className="cr-signin card">
      {error || pw.error ? (
        <p role="alert" className="cr-error">
          {error || pw.error}
        </p>
      ) : null}
      {googleEnabled ? (
        <>
          <a className="bb-btn bb-btn-outline" href={`/api/admin/auth/google?kind=student&next=${encodeURIComponent(next)}`}>
            Continue with Google
          </a>
          <p className="cr-or">
            <span />
            or
            <span />
          </p>
        </>
      ) : null}
      <form onSubmit={submit} className="cr-form">
        <label>
          <span className="label">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span className="label">Your name (new accounts)</span>
          <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>
        <button type="submit" className="bb-btn bb-btn-primary" disabled={busy}>
          {busy ? "Sending" : "Email me a sign-in link"}
        </button>
      </form>
      <details className="cr-pw">
        <summary>I have a password</summary>
        <form action={pwAction} className="cr-form">
          <input type="hidden" name="next" value={next} />
          <label>
            <span className="label">Email</span>
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            <span className="label">Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="bb-btn bb-btn-outline" disabled={pwPending}>
            {pwPending ? "Signing in" : "Sign in"}
          </button>
        </form>
      </details>
    </div>
  );
}
