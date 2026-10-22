"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, useToast } from "@/modules/forms/admin/ui";
import { cleanSlug } from "@/modules/forms/lib/sanitize";
import { ACCESS_LABELS, ACCESS_MODES } from "../lib/course-settings";
import "@/modules/landing/admin/landing-admin.css";
import "./classroom-admin.css";

export function NewCourseEditor({ siteUrl, categories }: { siteUrl: string; categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [access, setAccess] = useState("open");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const effective = touched ? cleanSlug(slug) : cleanSlug(title);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<{ id: number }>("classroom/courses", { method: "POST", body: { title, slug: effective || undefined, access, categoryId: categoryId ? Number(categoryId) : null } });
      router.push(`/admin/classroom/${res.id}/builder`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not create the course", "error");
      setBusy(false);
    }
  };

  return (
    <form
      className="bbfa-section bbc-new"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <label className="bbfa-new__name">
        <span className="bbfa-eyebrow">Name</span>
        <input type="text" required autoFocus placeholder="e.g. AI Operating System for Business Owners" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="bbfa-new__name">
        <span className="bbfa-eyebrow">Address</span>
        <input type="text" placeholder="ai-operating-system" value={touched ? slug : effective} style={{ fontSize: 18, height: 48 }} onChange={(e) => (setTouched(true), setSlug(e.target.value.toLowerCase()))} />
        <small className="bbfa-muted" style={{ display: "block", marginTop: 8 }}>
          {siteUrl.replace(/^https?:\/\//, "")}/classroom/<b>{effective || "…"}</b>
        </small>
      </label>
      <div>
        <div className="bbfa-eyebrow">Who can join</div>
        <div className="bbc-seg" role="radiogroup" aria-label="Access" style={{ marginTop: 8 }}>
          {ACCESS_MODES.map((m) => (
            <label key={m}>
              <input type="radio" name="access" checked={access === m} onChange={() => setAccess(m)} />
              {ACCESS_LABELS[m]}
            </label>
          ))}
        </div>
      </div>
      {categories.length ? (
        <div>
          <div className="bbfa-eyebrow">Category</div>
          <select className="bbfa-status-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category" style={{ marginTop: 8 }}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <p>
        <button className={`bbfa-btn${busy ? " is-loading" : ""}`} type="submit">
          Create course →
        </button>
      </p>
    </form>
  );
}
