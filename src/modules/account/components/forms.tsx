"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, saveProfileAction, type FormState } from "../actions";
import { Avatar } from "./ui";
import type { Profile } from "../lib/profile";

const idle: FormState = {};

function Field({ label, name, defaultValue, type = "text", autoComplete, hint, readOnly, invalid, maxLength, full }: { label: string; name: string; defaultValue?: string; type?: string; autoComplete?: string; hint?: string; readOnly?: boolean; invalid?: boolean; maxLength?: number; full?: boolean }) {
  return (
    <label className={`ac-field${full ? " ac-field--full" : ""}`} data-invalid={invalid ? "true" : undefined}>
      <span>{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} autoComplete={autoComplete} readOnly={readOnly} maxLength={maxLength} aria-invalid={invalid || undefined} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Status({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="ac-note ac-note--error">{state.error}</p>;
  if (state.ok) return <p role="status" className="ac-note">{state.message}</p>;
  return null;
}

export function ProfileForm({ p }: { p: Profile }) {
  const [state, action, pending] = useActionState(saveProfileAction, idle);
  return (
    <form action={action} className="ac-panel" noValidate>
      <h2>Your details</h2>
      <p>How you appear in your account. Your email is your sign-in and the link to your form responses, so it is shown here but not editable.</p>
      <div className="ac-fields ac-fields--2">
        <Field label="Full name" name="name" defaultValue={p.name} autoComplete="name" maxLength={120} invalid={state.field === "name"} />
        <Field label="Username" name="username" defaultValue={p.username} autoComplete="username" maxLength={30} hint="3 to 30 characters: letters, numbers, dots, dashes, underscores." invalid={state.field === "username"} />
        <Field label="Email" name="email" type="email" defaultValue={p.email} readOnly hint="To change your email, write to Boril." full />
        <Field label="Phone" name="phone" type="tel" defaultValue={p.phone} autoComplete="tel" maxLength={40} />
        <Field label="Country" name="country" defaultValue={p.country} autoComplete="country-name" maxLength={80} />
        <Field label="Company" name="company" defaultValue={p.company} autoComplete="organization" maxLength={120} />
        <Field label="Job title" name="jobTitle" defaultValue={p.jobTitle} autoComplete="organization-title" maxLength={120} />
        <Field label="Time zone" name="timezone" defaultValue={p.timezone} maxLength={60} hint="For example Asia/Dubai or Europe/Sofia." full />
        <label className="ac-field ac-field--full">
          <span>About you</span>
          <textarea name="bio" defaultValue={p.bio} maxLength={600} rows={4} />
          <small>A few lines. Up to 600 characters.</small>
        </label>
      </div>
      <div className="ac-actions">
        <button type="submit" className="bb-btn bb-btn-primary" disabled={pending}>
          {pending ? "Saving" : "Save changes"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, idle);
  return (
    <form action={action} className="ac-panel" noValidate>
      <h2>{hasPassword ? "Change password" : "Set a password"}</h2>
      <p>{hasPassword ? "Changing it signs you out on your other devices." : "You sign in with an emailed link now. A password lets you sign in without waiting for an email."}</p>
      <div className="ac-fields ac-fields--2">
        {hasPassword ? <Field label="Current password" name="current" type="password" autoComplete="current-password" invalid={state.field === "current"} full /> : null}
        <Field label="New password" name="next" type="password" autoComplete="new-password" hint="At least 10 characters." invalid={state.field === "next"} />
        <Field label="Repeat new password" name="again" type="password" autoComplete="new-password" invalid={state.field === "again"} />
      </div>
      <div className="ac-actions">
        <button type="submit" className="bb-btn bb-btn-outline" disabled={pending}>
          {pending ? "Saving" : hasPassword ? "Change password" : "Set password"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AvatarEditor({ name, url }: { name: string; url: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/account/avatar", { method: "POST", body: fd, credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "The picture could not be saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The picture could not be saved.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const remove = async () => {
    setBusy(true);
    setError("");
    await fetch("/api/account/avatar", { method: "DELETE", credentials: "same-origin" }).catch(() => null);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="ac-panel">
      <h2>Profile picture</h2>
      <p>A square picture works best. JPG, PNG or WebP, up to 8 MB.</p>
      <div className="ac-avatar-edit">
        <Avatar name={name} url={url} size={96} />
        <div>
          <div className="ac-avatar-edit__btns">
            <label className="bb-btn bb-btn-outline ac-btn-sm" style={{ cursor: "pointer" }}>
              {busy ? "Working" : url ? "Change picture" : "Upload a picture"}
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => send(e.target.files?.[0])} />
            </label>
            {url ? (
              <button type="button" className="ac-link" onClick={remove} disabled={busy}>
                Remove
              </button>
            ) : null}
          </div>
          {error ? <p role="alert" className="ac-note ac-note--error" style={{ marginTop: 10 }}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
