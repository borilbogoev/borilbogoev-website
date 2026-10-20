"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, useToast } from "@/modules/forms/admin/ui";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import { PIcon } from "./picon";
import "@/modules/landing/admin/landing-admin.css";
import "./presentations-admin.css";

type Template = { key: string; label: string; desc: string; slides: number; mode: string; orientation: string };
const ICONS: Record<string, string> = { blank: "+", talk: "●", workshop: "◆", pitch: "▮", explainer: "≡" };

export function NewDeckEditor({ templates, siteUrl, categories }: { templates: Template[]; siteUrl: string; categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [template, setTemplate] = useState("talk");
  const [mode, setMode] = useState("");
  const [orientation, setOrientation] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const effective = touched ? cleanSlug(slug) : cleanSlug(title);
  const tpl = templates.find((t) => t.key === template);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<{ id: number }>("presentations", { method: "POST", body: { title, slug: effective || undefined, template, mode: mode || undefined, orientation: orientation || undefined, categoryId: categoryId ? Number(categoryId) : null } });
      router.push(`/admin/presentations/${res.id}/builder`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not create the presentation", "error");
      setBusy(false);
    }
  };

  const choice = (name: string, value: string, set: (v: string) => void, options: [string, string, string?][]) => (
    <div className="bbp-choice" role="radiogroup" aria-label={name}>
      {options.map(([v, label, icon]) => (
        <label key={v}>
          <input type="radio" name={name} checked={value === v} onChange={() => set(v)} />
          {icon ? <PIcon name={icon} /> : null}
          {label}
        </label>
      ))}
    </div>
  );

  return (
    <form
      className="bbfa-section bbfa-new"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <label className="bbfa-new__name">
        <span className="bbfa-eyebrow">Name</span>
        <input type="text" required autoFocus placeholder="e.g. Session 001, 3 headaches of parents to kill with AI" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="bbfa-new__name" style={{ marginTop: 22 }}>
        <span className="bbfa-eyebrow">Address</span>
        <input type="text" placeholder="session001-3headaches-of-parents-to-kill-with-ai" value={touched ? slug : effective} style={{ fontSize: 18, height: 48 }} onChange={(e) => (setTouched(true), setSlug(e.target.value.toLowerCase()))} />
        <small className="bbfa-muted" style={{ display: "block", marginTop: 8 }}>
          {siteUrl.replace(/^https?:\/\//, "")}/p/<b>{effective || "…"}</b>
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
              {t.slides} {t.slides === 1 ? "slide" : "slides"} · {t.mode === "accordion" ? "accordion" : "slides"} · {t.orientation}
            </em>
          </label>
        ))}
      </div>

      <div className="bbfa-eyebrow" style={{ marginTop: 28 }}>
        Opens as {tpl ? <span className="bbfa-muted" style={{ textTransform: "none", letterSpacing: 0 }}>(the starting point suggests {tpl.mode})</span> : null}
      </div>
      {choice("mode", mode || tpl?.mode || "slides", setMode, [["slides", "Slides", "slides"], ["accordion", "Accordion", "rows"]])}
      <div className="bbfa-eyebrow" style={{ marginTop: 20 }}>
        Layout
      </div>
      {choice("orientation", orientation || tpl?.orientation || "landscape", setOrientation, [["landscape", "Landscape", "landscape"], ["portrait", "Portrait, for phones", "portrait"], ["auto", "Auto"]])}
      {categories.length ? (
        <>
          <div className="bbfa-eyebrow" style={{ marginTop: 20 }}>
            Category
          </div>
          <select className="bbfa-status-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category" style={{ marginTop: 8 }}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <p style={{ marginTop: 28 }}>
        <button className={`bbfa-btn${busy ? " is-loading" : ""}`} type="submit">
          Create presentation →
        </button>
      </p>
    </form>
  );
}
