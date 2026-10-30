"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { loginWithPassword, type LoginState } from "@/modules/auth/actions";
import { api } from "./client-api";
import "./school.css";

const ERRORS: Record<string, string> = {
  link_expired: "That link is not valid any more. Links work for 20 minutes. Ask for a new one below.",
  disabled: "This account is disabled. Contact us if this is a mistake.",
  signup_closed: "New accounts are closed right now. Ask for an invitation.",
  failed: "Sign-in failed. Please try again.",
  not_allowed: "No account matches this Google address, and new accounts are closed.",
  google_failed: "Google sign-in failed. Please try again.",
};

type Side = "new" | "account";

/** Two ways in, side by side: "New here" (red) creates an account from an emailed link, "I have an account" (ink) signs in. */
export function SignInForm({ googleEnabled, defaultNext = "/school/my" }: { googleEnabled: boolean; defaultNext?: string }) {
  const params = useSearchParams();
  const raw = params.get("next") ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : defaultNext;
  const [newEmail, setNewEmail] = useState("");
  const [name, setName] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [busy, setBusy] = useState<Side | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [fromSide, setFromSide] = useState<Side>("new");
  const [errors, setErrors] = useState<{ new: string; account: string }>({ new: "", account: ERRORS[params.get("error") ?? ""] ?? "" });
  const [pw, pwAction, pwPending] = useActionState<LoginState, FormData>(loginWithPassword, {});

  const sendLink = (side: Side, email: string, who: string) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(side);
    setErrors({ new: "", account: "" });
    try {
      await api("auth/link", { body: { email, name: who, next } });
      setFromSide(side);
      setSentTo(email);
    } catch (err) {
      setErrors({ new: "", account: "", [side]: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  };

  if (sentTo) {
    return (
      <div className={`cr-auth__card cr-auth__card--${fromSide === "new" ? "new" : "account"} cr-auth__sent`} role="status">
        <p className="cr-auth__eyebrow">Check your email</p>
        <h2 className="t-h2 mt-2">The link is sent.</h2>
        <p className="t-body-sm mt-3">
          If <strong>{sentTo}</strong> can sign in, an email with your link is on its way. It works for 20 minutes. Check the spam folder if you do not see it. For your privacy this page gives the same answer for every address.
        </p>
        <button type="button" className="cr-link mt-4" onClick={() => setSentTo("")}>
          Use another address
        </button>
      </div>
    );
  }

  return (
    <div className="cr-auth">
      <div className="cr-auth__grid">
        <section className="cr-auth__card cr-auth__card--new" aria-labelledby="auth-new">
          <p className="cr-auth__eyebrow">New here</p>
          <h2 id="auth-new" className="t-h2">
            Create your account
          </h2>
          <p className="cr-auth__lead">Enter your name and email. We send you a link that creates your account and signs you in. No password to set.</p>
          {errors.new ? (
            <p role="alert" className="cr-error">
              {errors.new}
            </p>
          ) : null}
          <form onSubmit={sendLink("new", newEmail, name)} className="cr-form">
            <label>
              <span className="label">Your name</span>
              <input type="text" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </label>
            <label>
              <span className="label">Email</span>
              <input type="email" required autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </label>
            <button type="submit" className="bb-btn bb-btn-primary" disabled={busy !== null}>
              {busy === "new" ? "Sending" : "Email me a link"}
            </button>
          </form>
          <p className="cr-auth__fine">Accounts are created only while sign-up is open.</p>
        </section>

        <section className="cr-auth__card cr-auth__card--account" aria-labelledby="auth-account">
          <p className="cr-auth__eyebrow">I have an account</p>
          <h2 id="auth-account" className="t-h2">
            Sign in
          </h2>
          {errors.account || (!linkMode && pw.error) ? (
            <p role="alert" className="cr-error">
              {errors.account || pw.error}
            </p>
          ) : null}
          {linkMode ? (
            <>
              <p className="cr-auth__lead">We email you a link that signs you in. It works for student accounts. Staff sign in with a password or Google.</p>
              <form onSubmit={sendLink("account", linkEmail, "")} className="cr-form">
                <label>
                  <span className="label">Email</span>
                  <input type="email" required autoComplete="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} />
                </label>
                <button type="submit" className="bb-btn cr-btn-ink" disabled={busy !== null}>
                  {busy === "account" ? "Sending" : "Email me a sign-in link"}
                </button>
              </form>
              <button type="button" className="cr-link cr-auth__switch" onClick={() => setLinkMode(false)}>
                Use my password instead
              </button>
            </>
          ) : (
            <>
              <p className="cr-auth__lead">Use the email and password of your account.</p>
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
                <button type="submit" className="bb-btn cr-btn-ink" disabled={pwPending}>
                  {pwPending ? "Signing in" : "Sign in"}
                </button>
              </form>
              <button type="button" className="cr-link cr-auth__switch" onClick={() => setLinkMode(true)}>
                No password? Email me a sign-in link
              </button>
            </>
          )}
        </section>
      </div>

      {googleEnabled ? (
        <div className="cr-auth__google">
          <p className="cr-or">
            <span />
            or
            <span />
          </p>
          <a className="bb-btn bb-btn-outline" href={`/api/admin/auth/google?kind=student&next=${encodeURIComponent(next)}`}>
            Continue with Google
          </a>
        </div>
      ) : null}
    </div>
  );
}
