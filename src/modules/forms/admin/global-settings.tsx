"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GlobalSettings } from "../lib/settings";
import { api, ApiError, Card, ColorField, SelectField, TextArea, TextField, Toggle, useToast } from "./ui";

const NAV = [
  ["appearance", "Appearance"],
  ["labels", "Labels & messages"],
  ["email", "Email"],
  ["security", "Spam & security"],
  ["uploads", "Uploads"],
  ["data", "Data & privacy"],
  ["system", "System"],
] as const;

type Props = { initial: GlobalSettings; tables: { name: string; rows: number | null }[]; timeZones: string[]; storageReady: boolean; emailReady: boolean };

export function GlobalSettingsEditor({ initial, tables, timeZones, storageReady, emailReady }: Props) {
  const toast = useToast();
  const [s, setS] = useState<GlobalSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("appearance");
  const set = <K extends keyof GlobalSettings>(k: K, v: GlobalSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const flag = (k: "honeypot" | "store_user_agent" | "track_views") => !!s[k];
  const setFlag = (k: "honeypot" | "store_user_agent" | "track_views") => (v: boolean) => set(k, v ? 1 : 0);
  const num = (k: keyof GlobalSettings) => (v: string) => set(k, Number(v) as never);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const els = NAV.map(([id]) => document.getElementById(`sec-${id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && setActive(x.target.id.replace("sec-", ""))), { rootMargin: "-30% 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ settings: GlobalSettings }>("forms/settings", { method: "PUT", body: s });
      setS(res.settings);
      toast("Saved");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bbfa-settings">
      <aside className="bbfa-settings__nav">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#sec-${id}`} className={active === id ? "is-active" : ""}>
            {label}
          </a>
        ))}
        <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
          Save settings
        </button>
      </aside>
      <div className="bbfa-settings__body">
        <Card id="sec-appearance" eyebrow="Appearance" title="Global design" desc="Defaults applied to every form. Each form can override mode, theme and accent.">
          <ColorField label="Accent color" value={s.accent_color} onChange={(v) => set("accent_color", v)} />
          <ColorField label="Text color (light theme)" value={s.text_color} onChange={(v) => set("text_color", v)} fallback="#111111" />
          <SelectField label="Font" value={s.font_family} onChange={(v) => set("font_family", v as GlobalSettings["font_family"])} choices={{ inter: "Inter (the site font)", inherit: "Inherit from the page", system: "System UI" }} />
          <TextField label="Corner radius (px)" type="number" min={0} max={32} value={s.radius} onChange={num("radius")} />
          <SelectField label="Default theme" value={s.default_theme} onChange={(v) => set("default_theme", v as GlobalSettings["default_theme"])} choices={{ light: "Light", dark: "Dark" }} />
          <SelectField label="Default layout mode" value={s.default_mode} onChange={(v) => set("default_mode", v as GlobalSettings["default_mode"])} choices={{ classic: "Classic", conversational: "Conversational" }} />
        </Card>

        <Card id="sec-labels" eyebrow="Labels & messages" title="Copy">
          <TextField label="Submit button" value={s.label_submit} onChange={(v) => set("label_submit", v)} />
          <TextField label="Next button" value={s.label_next} onChange={(v) => set("label_next", v)} />
          <TextField label="Previous button" value={s.label_prev} onChange={(v) => set("label_prev", v)} />
          <TextField label="Required field message" value={s.label_required} onChange={(v) => set("label_required", v)} />
          <TextArea label="Default thank you message (Markdown)" value={s.thankyou_message} onChange={(v) => set("thankyou_message", v)} rows={3} />
          <TextArea label="Default closed message (Markdown)" value={s.closed_message} onChange={(v) => set("closed_message", v)} rows={2} />
        </Card>

        <Card id="sec-email" eyebrow="Email" title="Sender and Resend" desc={emailReady ? "Emails are sent through Resend." : "Email is off: no Resend API key is saved yet."}>
          <p className="bbfa-field bbfa-field--wide">
            The Resend key, the sender address and the default recipients are set in <Link href="/admin/settings/email">Settings &gt; Email</Link>, where you can also send a test email.
          </p>
        </Card>

        <Card id="sec-security" eyebrow="Spam & security" title="Protection">
          <div className="bbfa-field">
            <Toggle label="Honeypot field" checked={flag("honeypot")} onChange={setFlag("honeypot")} help="Invisible trap field that bots fill in." />
            <Toggle label="Store browser user agent" checked={flag("store_user_agent")} onChange={setFlag("store_user_agent")} />
          </div>
          <TextField label="Minimum seconds before submit" type="number" min={0} max={60} value={s.min_seconds} onChange={num("min_seconds")} help="Rejects instant bot submissions." />
          <TextField label="Max submissions per IP per hour (0 = off)" type="number" min={0} value={s.rate_limit} onChange={num("rate_limit")} />
          <SelectField label="IP address storage" value={s.ip_mode} onChange={(v) => set("ip_mode", v as GlobalSettings["ip_mode"])} choices={{ anonymized: "Anonymized (GDPR friendly)", full: "Full IP", none: "Do not store" }} />
        </Card>

        <Card id="sec-uploads" eyebrow="Uploads" title="File uploads" desc={storageReady ? undefined : "File storage is not connected yet: add a Vercel Blob store to the project to turn uploads on."}>
          <TextField label="Max file size (MB)" type="number" min={1} max={50} value={s.upload_max_mb} onChange={num("upload_max_mb")} />
          <TextField label="Allowed extensions" value={s.upload_types} onChange={(v) => set("upload_types", v)} help="Comma separated. Executable and script types are always blocked." />
        </Card>

        <Card id="sec-data" eyebrow="Data & privacy" title="Data handling">
          <div className="bbfa-field">
            <Toggle label="Track views & starts (for conversion analytics)" checked={flag("track_views")} onChange={setFlag("track_views")} help="Aggregated daily counts only, no personal data." />
          </div>
          <TextField label="Auto-delete responses older than (days, 0 = keep)" type="number" min={0} value={s.retention_days} onChange={num("retention_days")} />
          <SelectField label="CSV delimiter" value={s.csv_delimiter} onChange={(v) => set("csv_delimiter", v as GlobalSettings["csv_delimiter"])} choices={{ ",": "Comma ,", ";": "Semicolon ; (Excel EU)", tab: "Tab" }} />
          <label className="bbfa-field">
            <span className="bbfa-label">Time zone</span>
            <select value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {timeZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <small>Used for dates in tables, CSV files, schedules and the dashboard.</small>
          </label>
          <PrivacyTools />
        </Card>

        <div className="bbfa-card" id="sec-system">
          <div className="bbfa-card__head">
            <div className="bbfa-eyebrow">System</div>
            <h3>Database tables</h3>
          </div>
          <table className="bbfa-table bbfa-sys">
            <tbody>
              {tables.map((t) => (
                <tr key={t.name}>
                  <td>
                    <code>{t.name}</code>
                  </td>
                  <td>{t.rows === null ? <span className="is-danger">missing</span> : `${t.rows.toLocaleString("en-US")} rows`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
            Save settings
          </button>
        </p>
      </div>
    </div>
  );
}

/** Find, export or erase every response that contains an email address (GDPR requests). */
function PrivacyTools() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<number | null>(null);

  const run = async (action: "export" | "erase") => {
    try {
      if (action === "erase" && !window.confirm(`Delete every response that contains ${email}? This cannot be undone.`)) return;
      const res = await api<{ count?: number; responses?: unknown[]; erased?: number }>("forms/privacy", { method: "POST", body: { email, action } });
      if (action === "erase") {
        toast(`${res.erased ?? 0} response(s) erased`);
        setFound(null);
        return;
      }
      setFound(res.count ?? 0);
      if (res.count) {
        const blob = new Blob([JSON.stringify(res.responses, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `responses-${email}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Request failed", "error");
    }
  };

  return (
    <div className="bbfa-field bbfa-field--wide">
      <span className="bbfa-label">Personal data requests</span>
      <div className="bbfa-inline">
        <input type="email" placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="button" className="bbfa-mini" disabled={!email} onClick={() => run("export")}>
          Export
        </button>
        <button type="button" className="bbfa-mini is-danger" disabled={!email} onClick={() => run("erase")}>
          Erase
        </button>
      </div>
      <small>{found === null ? "Exports or deletes every response whose answers contain exactly this email address." : `${found} response(s) found.`}</small>
    </div>
  );
}
