"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, useToast } from "./ui";

type Template = { key: string; label: string; desc: string; blocks: number };
const ICONS: Record<string, string> = { blank: "+", contact: "@", feedback: "★", event: "●", lead: "→" };

export function NewFormEditor({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("blank");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<{ id: number }>("forms", { method: "POST", body: { title, template } });
      router.push(`/admin/forms/${res.id}/build`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not create the form", "error");
      setBusy(false);
    }
  };

  return (
    <form
      className="bbfa-section bbfa-new"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <label className="bbfa-new__name">
        <span className="bbfa-eyebrow">Form name</span>
        <input type="text" required autoFocus placeholder="e.g. Workshop registration" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="bbfa-eyebrow" style={{ marginTop: 28 }}>
        Choose a starting point
      </div>
      <div className="bbfa-templates">
        {templates.map((t) => (
          <label className="bbfa-template" key={t.key}>
            <input type="radio" name="template" value={t.key} checked={template === t.key} onChange={() => setTemplate(t.key)} />
            <span className="bbfa-template__icon">{ICONS[t.key] ?? "•"}</span>
            <strong>{t.label}</strong>
            <span>{t.desc}</span>
            <em>
              {t.blocks} {t.blocks === 1 ? "block" : "blocks"}
            </em>
          </label>
        ))}
      </div>
      <p style={{ marginTop: 28 }}>
        <button className={`bbfa-btn${busy ? " is-loading" : ""}`} type="submit">
          Create form →
        </button>
      </p>
    </form>
  );
}
