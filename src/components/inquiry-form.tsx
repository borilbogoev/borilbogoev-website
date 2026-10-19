"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckIcon } from "./icons";

type Option = { value: string; label: string };
type Status = "idle" | "sending" | "sent" | "error";

/** The inquiry form shared by every page. `topic` says where it was sent from. */
export function InquiryForm({
  topic,
  optionsLabel,
  options,
  messageLabel = "Message",
  messagePlaceholder,
}: {
  topic: string;
  /** Label of the select (Tier, Format, Scope, Topic). Leave out for no select. */
  optionsLabel?: string;
  options?: Option[];
  messageLabel?: string;
  messagePlaceholder?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    setErrors({});
    setMessage("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, topic, page: location.pathname, elapsed: Date.now() - startedAt.current }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; fieldErrors?: Record<string, string>; error?: string };
      if (res.ok && json.ok) {
        setStatus("sent");
        form.reset();
        return;
      }
      setErrors(json.fieldErrors ?? {});
      setMessage(json.error ?? "Something went wrong. Please try again in a moment.");
      setStatus("error");
    } catch {
      setMessage("The message did not go through. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="card card-raised max-w-[640px]">
        <span className="icon-well">
          <CheckIcon size={18} />
        </span>
        <p className="t-h3 mt-4">Thank you. Your inquiry is in.</p>
        <p className="t-body-lg mt-2">I read every message myself and reply personally with the next steps.</p>
      </div>
    );
  }

  const err = (name: string) => errors[name];

  return (
    <form onSubmit={onSubmit} noValidate={false} className="card card-raised grid max-w-[640px] gap-5" aria-describedby={message ? "form-message" : undefined}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={`${topic}-name`}>Name</label>
          <input id={`${topic}-name`} name="name" type="text" autoComplete="name" required maxLength={120} aria-invalid={!!err("name")} />
          {err("name") && <p className="t-caption mt-1 text-brand-text">{err("name")}</p>}
        </div>
        <div className="field">
          <label htmlFor={`${topic}-email`}>Email</label>
          <input id={`${topic}-email`} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={200} aria-invalid={!!err("email")} />
          {err("email") && <p className="t-caption mt-1 text-brand-text">{err("email")}</p>}
        </div>
      </div>
      <div className={`grid gap-5 ${options?.length ? "sm:grid-cols-2" : ""}`}>
        <div className="field">
          <label htmlFor={`${topic}-company`}>
            Company <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id={`${topic}-company`} name="company" type="text" autoComplete="organization" maxLength={160} />
        </div>
        {options?.length ? (
          <div className="field">
            <label htmlFor={`${topic}-plan`}>{optionsLabel}</label>
            <select id={`${topic}-plan`} name="plan" defaultValue="" aria-invalid={!!err("plan")}>
              <option value="">Not sure yet</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={`${topic}-message`}>{messageLabel}</label>
        <textarea
          id={`${topic}-message`}
          name="message"
          required
          minLength={10}
          maxLength={4000}
          placeholder={messagePlaceholder}
          aria-invalid={!!err("message")}
        />
        {err("message") && <p className="t-caption mt-1 text-brand-text">{err("message")}</p>}
      </div>
      {/* Honeypot: people never see it, bots fill it in. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${topic}-website`}>Website</label>
        <input id={`${topic}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {message && (
        <p id="form-message" role="alert" className="t-body-sm font-semibold text-brand-text">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="bb-btn bb-btn-primary w-full sm:w-auto" disabled={status === "sending"}>
          {status === "sending" ? "Sending" : "Send Inquiry"}
        </button>
        <p className="t-caption max-w-[34ch] text-muted">I use your details only to reply to you.</p>
      </div>
    </form>
  );
}
