"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, Card, SelectField, TextArea, TextField, Toggle, useToast } from "@/modules/forms/admin/ui";
import type { SchoolSettings } from "../lib/settings";
import "@/modules/landing/admin/landing-admin.css";
import "./school-admin.css";

export function SchoolSettingsEditor({ initial, bunnyKeySaved, currencies }: { initial: SchoolSettings; bunnyKeySaved: boolean; currencies: readonly string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(bunnyKeySaved);
  const [key, setKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SchoolSettings>(k: K, v: SchoolSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ settings: SchoolSettings; bunnyKeySaved: boolean }>("school/settings", { method: "PUT", body: { ...s, ...(key ? { bunny_token_key: key } : removeKey ? { bunny_token_key: "" } : {}) } });
      setS(res.settings);
      setSaved(res.bunnyKeySaved);
      setKey("");
      setRemoveKey(false);
      toast("Settings saved");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bbfa-settings__body" style={{ maxWidth: 820 }}>
      <Card eyebrow="Students" title="Sign-up" desc="Students are ordinary users with the role Student, managed in Users. They sign in with an emailed link or with Google.">
        <div className="bbfa-field bbfa-field--wide">
          <Toggle label="Anyone can create a student account" checked={!!s.signup_open} onChange={(v) => set("signup_open", v ? 1 : 0)} help="Off: only people you add under Students can sign in." />
        </div>
        <TextField label="Tell me by email when a student asks to pay" type="email" value={s.notify_to} onChange={(v) => set("notify_to", v)} placeholder="Default: the inquiry address" help="Needs email (Resend) to be set up, as for Forms." />
      </Card>

      <Card eyebrow="Payments" title="Bank transfer details" desc="Shown to a student who enrols in a paid course, together with their payment reference. Nothing is charged online.">
        <SelectField label="Currency of paid courses" value={s.currency} onChange={(v) => set("currency", v)} choices={Object.fromEntries(currencies.map((c) => [c, c]))} help="New paid courses start with this currency. Each course can use another." />
        <TextField label="Beneficiary" value={s.bank_beneficiary} onChange={(v) => set("bank_beneficiary", v)} placeholder="Company or account holder" />
        <TextField label="Bank" value={s.bank_name} onChange={(v) => set("bank_name", v)} />
        <TextField label="IBAN" value={s.bank_iban} onChange={(v) => set("bank_iban", v)} />
        <TextField label="SWIFT / BIC" value={s.bank_swift} onChange={(v) => set("bank_swift", v)} />
        <div className="bbfa-field bbfa-field--wide">
          <TextArea label="Instructions" value={s.bank_instructions} onChange={(v) => set("bank_instructions", v)} rows={3} help="Shown under the details. Say when access opens." />
        </div>
      </Card>

      <Card eyebrow="Video" title="Bunny.net Stream" desc="Videos in lessons can be protected: each student gets a short-lived signed link, so a copied link stops working.">
        <TextField label="Library ID" value={s.bunny_library_id} onChange={(v) => set("bunny_library_id", v)} placeholder="e.g. 123456" help="Bunny dashboard, Stream, your library, API: the number called Library ID. It is also in every embed address." />
        <TextField label="Signed link lifetime (hours)" type="number" min={1} max={48} value={s.bunny_token_hours} onChange={(v) => set("bunny_token_hours", Number(v) || 6)} help="How long a student's video link works after the lesson opens." />
        <div className="bbfa-field bbfa-field--wide">
          <TextField
            label={saved && !removeKey ? "Embed token key (saved)" : "Embed token key"}
            type="password"
            value={key}
            onChange={(v) => {
              setKey(v);
              if (v) setRemoveKey(false);
            }}
            placeholder={saved && !removeKey ? "Leave empty to keep the saved key" : "Paste the key from Bunny"}
            help={
              <>
                Bunny dashboard, Stream, your library, Security: turn on <b>Embed view token authentication</b> and copy the <b>token authentication key</b>. It is stored encrypted and never shown again.
                {saved && !removeKey ? (
                  <>
                    {" "}
                    <button type="button" className="bbfa-tag" onClick={() => (setRemoveKey(true), setKey(""))}>
                      Remove the key
                    </button>
                  </>
                ) : removeKey ? (
                  " The key will be removed when you save."
                ) : null}
              </>
            }
          />
        </div>
        <div className="bbfa-field bbfa-field--wide">
          <small className="bbfa-muted">In a lesson, add a Video block and paste the video ID from Bunny (or its embed link). Without the key, Bunny videos still play but are not protected.</small>
        </div>
      </Card>

      <Card eyebrow="Catalog" title="The School page" desc="The intro at /school.">
        <TextField label="Eyebrow" value={s.hub_eyebrow} onChange={(v) => set("hub_eyebrow", v)} />
        <TextField label="Heading" value={s.hub_title} onChange={(v) => set("hub_title", v)} />
        <div className="bbfa-field bbfa-field--wide">
          <TextArea label="Intro" value={s.hub_intro} onChange={(v) => set("hub_intro", v)} rows={2} />
        </div>
      </Card>

      <p>
        <button type="button" className={`bbfa-btn${busy ? " is-loading" : ""}`} onClick={save}>
          Save settings
        </button>
      </p>
    </div>
  );
}
