"use client";

import { useEffect, useRef, useState } from "react";
import { cleanSlug } from "../lib/sanitize";
import type { FormSettings } from "../lib/settings";
import { api, ApiError, Card, ColorField, SelectField, TextArea, TextField, Toggle, useCopy, useToast } from "./ui";

type Props = {
  formId: number;
  title: string;
  status: string;
  slug: string;
  settings: FormSettings;
  emailFields: { key: string; label: string }[];
  mergeTags: string[];
  defaults: { submit: string; next: string; prev: string; adminEmail: string };
  siteUrl: string;
  readOnly: boolean;
};

const NAV = [
  ["general", "General"],
  ["display", "Display"],
  ["after-submit", "After submit"],
  ["notifications", "Notifications"],
  ["access", "Access & limits"],
  ["integrations", "Integrations"],
] as const;

export function FormSettingsEditor({ formId, title: t0, status: st0, slug: sl0, settings: s0, emailFields, mergeTags, defaults, siteUrl, readOnly }: Props) {
  const toast = useToast();
  const copy = useCopy();
  const [title, setTitle] = useState(t0);
  const [status, setStatus] = useState(st0);
  const [slug, setSlug] = useState(sl0);
  const [s, setS] = useState<FormSettings>(s0);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("general");
  const root = useRef<HTMLDivElement>(null);
  const set = <K extends keyof FormSettings>(k: K, v: FormSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const flag = (k: keyof FormSettings) => !!s[k];
  const setFlag = (k: keyof FormSettings) => (v: boolean) => setS((cur) => ({ ...cur, [k]: v ? 1 : 0 }));

  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(`sec-${id}`)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((en) => en.forEach((x) => x.isIntersecting && setActive(x.target.id.replace("sec-", ""))), { rootMargin: "-30% 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ form: { slug: string | null } }>(`forms/${formId}`, { method: "PUT", body: { title, status, slug: cleanSlug(slug) || null, settings: s } });
      setSlug(res.form.slug ?? "");
      toast("Saved");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const pageUrl = slug ? `${siteUrl}/s/${cleanSlug(slug)}` : "";

  return (
    <div className="bbfa-settings" ref={root}>
      <aside className="bbfa-settings__nav">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#sec-${id}`} className={active === id ? "is-active" : ""}>
            {label}
          </a>
        ))}
        {!readOnly ? (
          <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
            Save settings
          </button>
        ) : null}
      </aside>
      <fieldset className="bbfa-settings__body" disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <Card id="sec-general" eyebrow="General" title="Form basics">
          <TextField label="Form name" value={title} onChange={setTitle} />
          <SelectField label="Status" value={status} onChange={setStatus} choices={{ active: "Active: accepting responses", draft: "Draft: visible to signed-in staff only", closed: "Closed: shows closed message" }} />
          <TextField
            label="Page address"
            value={slug}
            onChange={(v) => setSlug(v.toLowerCase())}
            placeholder="e.g. you-and-ai"
            help={
              pageUrl ? (
                <>
                  The form has its own page at{" "}
                  <button type="button" className="bbfa-tag" onClick={() => copy(pageUrl)}>
                    {pageUrl}
                  </button>
                </>
              ) : (
                "Leave empty if the form is only embedded in other pages."
              )
            }
          />
          <TextField label="Page title (browser tab)" value={s.page_title} onChange={(v) => set("page_title", v)} placeholder={title} help="Used by the form's own page. Empty uses the form name." />
          <TextArea label="Internal note" value={s.description} onChange={(v) => set("description", v)} rows={2} help="Only visible to staff." />
        </Card>

        <Card id="sec-display" eyebrow="Display" title="Look & feel">
          <SelectField label="Layout mode" value={s.mode} onChange={(v) => set("mode", v as FormSettings["mode"])} choices={{ "": "Global default", classic: "Classic: pages split by Page Break", conversational: "Conversational: one question per screen" }} />
          <SelectField label="Theme" value={s.theme} onChange={(v) => set("theme", v as FormSettings["theme"])} choices={{ "": "Global default", light: "Light", dark: "Dark" }} />
          <ColorField label="Accent color" value={s.accent} onChange={(v) => set("accent", v)} help="Leave empty to use the global accent." />
          <TextField label="Max width (px)" type="number" min={320} max={1600} value={s.max_width} onChange={(v) => set("max_width", Number(v))} />
          <TextField label="Submit button label" value={s.submit_label} onChange={(v) => set("submit_label", v)} placeholder={defaults.submit} />
          <TextField label="Next button label" value={s.next_label} onChange={(v) => set("next_label", v)} placeholder={defaults.next} />
          <TextField label="Previous button label" value={s.prev_label} onChange={(v) => set("prev_label", v)} placeholder={defaults.prev} />
          <div className="bbfa-field">
            <Toggle label="Show progress bar" checked={flag("progress")} onChange={setFlag("progress")} />
            <Toggle label="Show page counter (1 / 3)" checked={flag("page_numbers")} onChange={setFlag("page_numbers")} />
          </div>
        </Card>

        <Card id="sec-after-submit" eyebrow="After submit" title="Thank you experience">
          <SelectField label="After submission" value={s.after_submit} onChange={(v) => set("after_submit", v as FormSettings["after_submit"])} choices={{ message: "Show thank you message", page: "Redirect to a page of this site", url: "Redirect to a custom URL" }} />
          {s.after_submit === "page" ? <TextField label="Page path" value={s.thankyou_page} onChange={(v) => set("thankyou_page", v)} placeholder="/thank-you" help="A path on this site, starting with /." /> : null}
          {s.after_submit === "url" ? <TextField label="Redirect URL" type="url" value={s.redirect_url} onChange={(v) => set("redirect_url", v)} placeholder="https://" /> : null}
          <TextArea label="Thank you message (Markdown)" value={s.thankyou_message} onChange={(v) => set("thankyou_message", v)} help="Empty uses the global message. Field tags like {first_name} are supported." />
          <div className="bbfa-field">
            <Toggle label="Append form & response number to redirect URL" checked={flag("pass_params")} onChange={setFlag("pass_params")} help={<code>?bbf_form=1&amp;bbf_response=42</code>} />
          </div>
        </Card>

        <Card id="sec-notifications" eyebrow="Notifications" title="Emails">
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Email me on every new response" checked={flag("notify_admin")} onChange={setFlag("notify_admin")} />
          </div>
          <TextField label="Recipients (comma separated)" value={s.notify_to} onChange={(v) => set("notify_to", v)} placeholder={defaults.adminEmail} />
          <TextField label="Subject" value={s.notify_subject} onChange={(v) => set("notify_subject", v)} />
          <TextArea label="Message (Markdown)" value={s.notify_body} onChange={(v) => set("notify_body", v)} />
          <div className="bbfa-field bbfa-field--wide bbfa-divider" />
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Send confirmation email to the respondent" checked={flag("autoresponder")} onChange={setFlag("autoresponder")} />
          </div>
          <SelectField label="Respondent email field" value={s.auto_email_field} onChange={(v) => set("auto_email_field", v)} choices={{ "": "Auto-detect first email field", ...Object.fromEntries(emailFields.map((e) => [e.key, `${e.label} (${e.key})`])) }} />
          <TextField label="Subject" value={s.auto_subject} onChange={(v) => set("auto_subject", v)} />
          <TextArea label="Message (Markdown)" value={s.auto_body} onChange={(v) => set("auto_body", v)} rows={5} />
          <div className="bbfa-field bbfa-field--wide">
            <span className="bbfa-label">Merge tags (click to copy)</span>
            <div className="bbfa-tags">
              {mergeTags.map((tag) => (
                <button key={tag} type="button" className="bbfa-tag" onClick={() => copy(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card id="sec-access" eyebrow="Access & limits" title="Schedule and limits">
          <TextField label="Open from" type="datetime-local" value={s.open_at ? s.open_at.replace(" ", "T") : ""} onChange={(v) => set("open_at", v)} />
          <TextField label="Close at" type="datetime-local" value={s.close_at ? s.close_at.replace(" ", "T") : ""} onChange={(v) => set("close_at", v)} />
          <TextField label="Maximum responses (0 = unlimited)" type="number" min={0} value={s.max_responses} onChange={(v) => set("max_responses", Number(v))} />
          <TextArea label="Closed message (Markdown)" value={s.closed_message} onChange={(v) => set("closed_message", v)} rows={2} help="Empty uses the global message." />
          <div className="bbfa-field">
            <Toggle label="Only signed-in users can submit" checked={flag("require_login")} onChange={setFlag("require_login")} />
            <Toggle label="One response per visitor (cookie)" checked={flag("one_per_visitor")} onChange={setFlag("one_per_visitor")} />
          </div>
        </Card>

        <Card id="sec-integrations" eyebrow="Integrations" title="Webhook" desc="POST every new response as JSON to n8n, Make, Zapier or your own endpoint.">
          <div className="bbfa-field bbfa-field--wide">
            <Toggle label="Enable webhook" checked={flag("webhook_enabled")} onChange={setFlag("webhook_enabled")} />
          </div>
          <TextField label="Endpoint URL" type="url" value={s.webhook_url} onChange={(v) => set("webhook_url", v)} placeholder="https://" />
          <TextField label="Signing secret (optional)" value={s.webhook_secret} onChange={(v) => set("webhook_secret", v)} help={<>Adds header <code>X-BBForms-Signature: sha256=HMAC(body)</code>.</>} />
        </Card>

        {!readOnly ? (
          <p>
            <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
              Save settings
            </button>
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
