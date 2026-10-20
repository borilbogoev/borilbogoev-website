"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, useToast } from "@/modules/forms/admin/ui";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import "./landing-admin.css";

type Template = { key: string; label: string; desc: string; blocks: number };
const ICONS: Record<string, string> = { blank: "+", webinar: "●", lead_magnet: "↓", sales: "$" };

export function NewPageEditor({ templates, siteUrl }: { templates: Template[]; siteUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [template, setTemplate] = useState("blank");
  const [busy, setBusy] = useState(false);
  const effective = touched ? cleanSlug(slug) : cleanSlug(title);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<{ id: number }>("landing", { method: "POST", body: { title, slug: effective || undefined, template } });
      router.push(`/admin/landing/${res.id}/builder`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not create the page", "error");
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
        <span className="bbfa-eyebrow">Page name</span>
        <input type="text" required autoFocus placeholder="e.g. AI for busy parents, webinar" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="bbfa-new__name" style={{ marginTop: 22 }}>
        <span className="bbfa-eyebrow">Address</span>
        <input
          type="text"
          placeholder="ai-for-busy-parents"
          value={touched ? slug : effective}
          style={{ fontSize: 18, height: 48 }}
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
        <small className="bbfa-muted" style={{ display: "block", marginTop: 8 }}>
          {siteUrl.replace(/^https?:\/\//, "")}/l/<b>{effective || "…"}</b>
        </small>
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
          Create page →
        </button>
      </p>
    </form>
  );
}
