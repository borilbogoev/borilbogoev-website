"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageControl, type ImageValue } from "@/modules/forms/admin/controls";
import { api, ApiError, useConfirm, useToast } from "@/modules/forms/admin/ui";
import "@/modules/landing/admin/landing-admin.css";
import "./school-admin.css";

export type CategoryRow = { id: number; name: string; slug: string; summary: string; image: { url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] }; courses: number };

const asImage = (i: CategoryRow["image"]): ImageValue => ({ id: 0, url: i.url ?? "", width: i.width, height: i.height, variants: i.variants });

export function CategoriesEditor({ categories, canWrite, canDelete }: { categories: CategoryRow[]; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [edits, setEdits] = useState<Record<number, { name: string; summary: string; image: ImageValue }>>({});
  const [fresh, setFresh] = useState({ name: "", summary: "", image: { id: 0, url: "" } as ImageValue });

  const call = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
      return false;
    }
  };
  const draft = (c: CategoryRow) => edits[c.id] ?? { name: c.name, summary: c.summary, image: asImage(c.image) };
  const patch = (c: CategoryRow, p: Partial<{ name: string; summary: string; image: ImageValue }>) => setEdits((cur) => ({ ...cur, [c.id]: { ...draft(c), ...p } }));

  return (
    <div>
      <ul className="bbc-cats">
        {categories.map((c, i) => {
          const d = draft(c);
          return (
            <li key={c.id}>
              <div>{d.image.url ? <img src={d.image.variants?.[0]?.url ?? d.image.url} alt="" /> : <div className="bbc-ph" />}</div>
              <fieldset disabled={!canWrite} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <div className="bbfa-ctl">
                  <label className="bbfa-label">Name</label>
                  <input type="text" value={d.name} onChange={(e) => patch(c, { name: e.target.value })} />
                </div>
                <div className="bbfa-ctl">
                  <label className="bbfa-label">Short description</label>
                  <textarea rows={2} value={d.summary} onChange={(e) => patch(c, { summary: e.target.value })} />
                </div>
                <ImageControl label="Image" value={d.image} uploadUrl="/api/admin/school/media" onChange={(v) => patch(c, { image: v })} />
                <small className="bbfa-muted">
                  /school/category/{c.slug} · {c.courses} {c.courses === 1 ? "course" : "courses"}
                </small>
              </fieldset>
              <div className="bbp-actions" style={{ flexDirection: "column" }}>
                {canWrite && edits[c.id] ? (
                  <button
                    type="button"
                    className="bbfa-btn bbfa-btn--sm"
                    onClick={async () => {
                      const e = edits[c.id];
                      if (await call(() => api(`school/categories/${c.id}`, { method: "PUT", body: { name: e.name, summary: e.summary, image: e.image } }), "Category saved")) setEdits((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => Number(k) !== c.id)));
                    }}
                  >
                    Save
                  </button>
                ) : null}
                {canWrite ? (
                  <>
                    <button type="button" className="bbfa-mini" disabled={i === 0} onClick={() => void call(() => api(`school/categories/${c.id}/move`, { method: "POST", body: { dir: -1 } }), "Moved")}>
                      Move up
                    </button>
                    <button type="button" className="bbfa-mini" disabled={i === categories.length - 1} onClick={() => void call(() => api(`school/categories/${c.id}/move`, { method: "POST", body: { dir: 1 } }), "Moved")}>
                      Move down
                    </button>
                  </>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    className="bbfa-mini"
                    onClick={async () => {
                      if (await confirm(`Delete the category "${c.name}"? Its courses are kept, without a category.`, "Delete category")) await call(() => api(`school/categories/${c.id}`, { method: "DELETE" }), "Category deleted");
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
        {!categories.length ? <li style={{ display: "block" }}>No categories yet. Add the first one below.</li> : null}
      </ul>

      {canWrite ? (
        <form
          className="bbc-new"
          style={{ marginTop: 24 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!fresh.name.trim()) return;
            if (await call(() => api("school/categories", { method: "POST", body: fresh }), "Category added")) setFresh({ name: "", summary: "", image: { id: 0, url: "" } });
          }}
        >
          <div className="bbfa-eyebrow">New category</div>
          <input type="text" value={fresh.name} onChange={(e) => setFresh({ ...fresh, name: e.target.value })} placeholder="e.g. AI for business" aria-label="Category name" />
          <textarea rows={2} value={fresh.summary} onChange={(e) => setFresh({ ...fresh, summary: e.target.value })} placeholder="Short description" aria-label="Short description" />
          <ImageControl label="Image" value={fresh.image} uploadUrl="/api/admin/school/media" onChange={(v) => setFresh({ ...fresh, image: v })} />
          <p>
            <button type="submit" className="bbfa-btn" disabled={!fresh.name.trim()}>
              Add category
            </button>
          </p>
        </form>
      ) : null}
    </div>
  );
}
