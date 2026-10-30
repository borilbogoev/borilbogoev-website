"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, Card, SelectField, TextField, useToast } from "@/modules/forms/admin/ui";
import type { LogEntry } from "../lib/config";
import type { TemplateInfo } from "../lib/templates";
import type { EmailView } from "../lib/view";
import "@/modules/landing/admin/landing-admin.css";

const KEY_TEXT: Record<EmailView["keyState"], string> = {
  database: "A key is saved here, encrypted.",
  environment: "The key comes from the RESEND_API_KEY environment variable. Saving a key here replaces it.",
  unreadable: "A key is saved but cannot be read any more (AUTH_SECRET changed). Enter it again.",
  none: "No key yet. No email can be sent until you add one.",
};

export function EmailSettingsEditor({ initial, templates, log, defaultTo }: { initial: EmailView; templates: TemplateInfo[]; log: LogEntry[]; defaultTo: string }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState(initial);
  const [s, setS] = useState({ fromEmail: initial.fromEmail, fromName: initial.fromName, replyTo: initial.replyTo, adminTo: initial.adminTo });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState(templates[0]?.id ?? "");
  const [to, setTo] = useState(defaultTo);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof s) => (v: string) => setS((cur) => ({ ...cur, [k]: v }));

  const save = async (patch: { apiKey?: string } = {}) => {
    setBusy(true);
    try {
      const res = await api<EmailView>("settings/email", { method: "PUT", body: { ...s, ...patch } });
      setView(res);
      setKey("");
      toast("Email settings saved");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await api<{ id: string }>("settings/email/test", { method: "POST", body: { template, to } });
      setResult({ ok: true, text: `Resend accepted the message (id ${res.id}). It should arrive at ${to} in a minute. Check the spam folder if it does not.` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof ApiError ? e.message : "The test failed." });
    } finally {
      setTesting(false);
      router.refresh();
    }
  };

  const chosen = templates.find((t) => t.id === template);
  const groups = Array.from(new Set(templates.map((t) => t.group)));

  return (
    <div className="bbfa-settings__body" style={{ maxWidth: 820 }}>
      <Card eyebrow="Resend" title="API key" desc="Every email the site sends goes through Resend: sign-in links, payment details, form notifications and inquiries. The key is stored encrypted in the database and is never shown again after you save it.">
        <div className="bbfa-field bbfa-field--wide">
          <span className="bbfa-label">Status</span>
          <p>
            {KEY_TEXT[view.keyState]}
            {view.keyMask ? <> Key: <code>{view.keyMask}</code></> : null}
          </p>
        </div>
        <TextField wide label={view.keyState === "database" ? "Replace the key" : "Resend API key"} type="password" value={key} onChange={setKey} placeholder="re_..." autoComplete="off" help={<>Create it in Resend under API Keys. A key with only the sending permission is enough.</>} />
        <div className="bbfa-field bbfa-field--wide" style={{ flexDirection: "row", gap: 12 }}>
          <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} disabled={busy || !key.trim()} onClick={() => save({ apiKey: key })}>
            Save key
          </button>
          {view.keyState === "database" || view.keyState === "unreadable" ? (
            <button type="button" className="bbfa-btn bbfa-btn--ghost" disabled={busy} onClick={() => save({ apiKey: "" })}>
              Remove saved key
            </button>
          ) : null}
        </div>
      </Card>

      <Card eyebrow="Sender" title="From and recipients" desc="The From address must be on a domain you verified in Resend. Without one, Resend only delivers to the owner of the Resend account.">
        <TextField label="From name" value={s.fromName} onChange={set("fromName")} placeholder="Boril Bogoev" />
        <TextField label="From email" type="email" value={s.fromEmail} onChange={set("fromEmail")} placeholder="hello@your-verified-domain" />
        <TextField label="Reply-to (optional)" type="email" value={s.replyTo} onChange={set("replyTo")} help="Where replies go. Empty: replies go to the From address." />
        <TextField label="Your address for notices" value={s.adminTo} onChange={set("adminTo")} help="Inquiries and new form responses are sent here. Separate several with commas." />
        <div className="bbfa-field bbfa-field--wide">
          <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} disabled={busy} onClick={() => save()}>
            Save sender
          </button>
        </div>
      </Card>

      <Card eyebrow="Test" title="Send a test email" desc="Sends the chosen email with sample data, through the same code a real email uses. Save the key and sender first.">
        <SelectField
          wide
          label="Email"
          value={template}
          onChange={setTemplate}
          choices={Object.fromEntries(groups.flatMap((g) => templates.filter((t) => t.group === g).map((t) => [t.id, `${g}: ${t.label}`])))}
          help={chosen?.description}
        />
        <TextField wide label="Send to" type="email" value={to} onChange={setTo} />
        <div className="bbfa-field bbfa-field--wide">
          <button type="button" className={`bbfa-btn${testing ? " is-loading" : ""}`} disabled={testing || !to.trim()} onClick={test}>
            Send test email
          </button>
          {result ? (
            <p role="status" style={{ marginTop: 10, color: result.ok ? "#1C8C4E" : "#C72C2C", fontWeight: 600 }}>
              {result.ok ? "Sent. " : "Not sent. "}
              {result.text}
            </p>
          ) : null}
        </div>
      </Card>

      <Card eyebrow="Log" title="Recent sends" desc="The last 30 emails the site tried to send, including failures, with the answer from Resend.">
        {log.length ? (
          <div className="bbfa-field bbfa-field--wide">
            <div className="bbfa-table-wrap">
              <table className="bbfa-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Email</th>
                    <th>To</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={`${l.at}-${i}`}>
                      <td>{new Date(l.at).toLocaleString("en-GB")}</td>
                      <td>{l.template}</td>
                      <td>{l.to}</td>
                      <td style={{ color: l.ok ? "#1C8C4E" : "#C72C2C" }}>{l.ok ? "Sent" : l.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="bbfa-field bbfa-field--wide">Nothing sent yet.</p>
        )}
      </Card>
    </div>
  );
}
