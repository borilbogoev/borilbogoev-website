"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, CopyCode, fmtNum, Modal, useConfirm, useFormatters, useToast } from "@/modules/forms/admin/ui";
import { PIcon } from "./picon";
import { StatusPill } from "./tabs";
import "@/modules/landing/admin/landing-admin.css";
import "./presentations-admin.css";

export type DeckRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  mode: string;
  orientation: string;
  categoryName: string;
  tags: string[];
  hasPassword: boolean;
  slides: number;
  updatedAt: string;
  views: number;
  unique: number;
  avgReach: number | null;
};

export function DecksTable({ rows, canWrite, canDelete, siteUrl }: { rows: DeckRow[]; canWrite: boolean; canDelete: boolean; siteUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useFormatters();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : fail, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bbfa-table-wrap" aria-busy={busy}>
      <table className="bbfa-table bbfa-forms">
        <thead>
          <tr>
            <th>Presentation</th>
            <th>Address</th>
            <th className="num">Slides</th>
            <th className="num">Views</th>
            <th className="num">Avg reach</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const base = `/admin/presentations/${r.id}`;
            const url = `${siteUrl}/p/${r.slug}`;
            return (
              <tr key={r.id}>
                <td>
                  <Link className="bbfa-forms__title" href={`${base}/builder`}>
                    {r.title}
                  </Link>
                  <div className="bbfa-sub">
                    #{r.id} · updated {f.ago(r.updatedAt)}
                    {r.categoryName ? ` · ${r.categoryName}` : ""}
                  </div>
                  {r.tags.length ? (
                    <div className="bbp-tags" style={{ marginTop: 4 }}>
                      {r.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td>
                  <CopyCode text={url}>/p/{r.slug}</CopyCode>
                  <div className="bbp-icons" style={{ marginTop: 4 }}>
                    <PIcon name={r.mode === "accordion" ? "rows" : "slides"} />
                    <span>{r.mode === "accordion" ? "Accordion" : "Slides"}</span>
                    <PIcon name={r.orientation === "portrait" ? "portrait" : "landscape"} />
                    <span>{r.orientation.charAt(0).toUpperCase() + r.orientation.slice(1)}</span>
                    {r.hasPassword ? (
                      <>
                        <PIcon name="lock" />
                        <span>Password</span>
                      </>
                    ) : null}
                  </div>
                </td>
                <td className="num">{fmtNum(r.slides)}</td>
                <td className="num">{fmtNum(r.views)}</td>
                <td className="num">{r.avgReach === null ? "–" : r.avgReach}</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
                <td className="bbfa-row-actions">
                  <Link href={`${base}/builder`}>{canWrite ? "Build" : "View"}</Link>
                  <Link href={`${base}/dashboard`}>Dashboard</Link>
                  <a href={`/admin/preview/presentations/${r.id}`} target="_blank" rel="noopener noreferrer">
                    Present ↗
                  </a>
                  {canWrite ? (
                    <a href="#" onClick={(e) => (e.preventDefault(), void run(() => api(`presentations/${r.id}/duplicate`, { method: "POST" }), "Presentation duplicated", "Could not duplicate"))}>
                      Duplicate
                    </a>
                  ) : null}
                  {canDelete ? (
                    <a
                      href="#"
                      className="is-danger"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (await confirm("Delete this presentation with its slides and statistics? This cannot be undone.")) void run(() => api(`presentations/${r.id}`, { method: "DELETE" }), "Presentation deleted", "Could not delete");
                      }}
                    >
                      Delete
                    </a>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type Cat = { id: number; name: string; slug: string; decks: number };

/** Add, rename and delete categories. Decks in a deleted category are kept, without a category. */
export function CategoriesManager({ categories, canWrite, canDelete }: { categories: Cat[]; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(categories);
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});

  const call = async (path: string, method: string, body?: unknown) => {
    try {
      const res = await api<{ categories: Cat[] }>(path, { method, body });
      setList(res.categories);
      router.refresh();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
      return false;
    }
  };

  return (
    <>
      <button type="button" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => setOpen(true)}>
        Categories
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} small>
          <div className="bbfa-eyebrow">Library</div>
          <h3 style={{ margin: "4px 0 14px" }}>Categories</h3>
          {list.length ? (
            <ul className="bbp-cats">
              {list.map((c) => (
                <li key={c.id}>
                  <input value={edits[c.id] ?? c.name} disabled={!canWrite} onChange={(e) => setEdits((cur) => ({ ...cur, [c.id]: e.target.value }))} aria-label={`Name of ${c.name}`} />
                  <em>{c.decks} {c.decks === 1 ? "deck" : "decks"}</em>
                  {canWrite && edits[c.id] !== undefined && edits[c.id] !== c.name ? (
                    <button type="button" className="bbfa-mini" onClick={async () => (await call(`presentations/categories/${c.id}`, "PUT", { name: edits[c.id] })) && setEdits((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => Number(k) !== c.id)))}>
                      Save
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="bbfa-mini"
                      onClick={async () => {
                        if (await confirm(`Delete the category "${c.name}"? Its presentations are kept, without a category.`, "Delete category")) await call(`presentations/categories/${c.id}`, "DELETE");
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="bbfa-muted">No categories yet.</p>
          )}
          {canWrite ? (
            <form
              style={{ display: "flex", gap: 8, marginTop: 16 }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (name.trim() && (await call("presentations/categories", "POST", { name }))) setName("");
              }}
            >
              <input style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Webinars" aria-label="New category" />
              <button type="submit" className="bbfa-btn bbfa-btn--sm" disabled={!name.trim()}>
                Add
              </button>
            </form>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
