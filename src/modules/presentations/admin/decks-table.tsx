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

const ACT_ICONS: Record<string, React.ReactNode> = {
  build: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  dashboard: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  present: <path d="M8 5.5v13l11-6.5z" />,
  duplicate: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  delete: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
};

/** Outline icons on a 24px grid, 2px stroke. */
function ActIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ACT_ICONS[name]}
    </svg>
  );
}

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
            <th className="num">Slides</th>
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
                  <div style={{ marginTop: 6 }}>
                    <CopyCode text={url}>/p/{r.slug}</CopyCode>
                  </div>
                  <div className="bbp-icons" style={{ marginTop: 6 }}>
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
                  <div className="bbfa-sub" style={{ marginTop: 6 }}>
                    #{r.id} · updated {f.ago(r.updatedAt)}
                    {r.categoryName ? ` · ${r.categoryName}` : ""}
                  </div>
                  {r.tags.length ? (
                    <div className="bbp-tags" style={{ marginTop: 6 }}>
                      {r.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="num">{fmtNum(r.slides)}</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
                <td className="bbfa-row-actions bbp-acts">
                  <Link href={`${base}/builder`} className="bbp-act" data-tip={canWrite ? "Build" : "View"} aria-label={canWrite ? "Build" : "View"}>
                    <ActIcon name="build" />
                  </Link>
                  <Link href={`${base}/dashboard`} className="bbp-act" data-tip="Dashboard" aria-label="Dashboard">
                    <ActIcon name="dashboard" />
                  </Link>
                  <a href={`/admin/preview/presentations/${r.id}`} target="_blank" rel="noopener noreferrer" className="bbp-act" data-tip="Present" aria-label="Present (opens in a new tab)">
                    <ActIcon name="present" />
                  </a>
                  {canWrite ? (
                    <a href="#" className="bbp-act" data-tip="Duplicate" aria-label="Duplicate" onClick={(e) => (e.preventDefault(), void run(() => api(`presentations/${r.id}/duplicate`, { method: "POST" }), "Presentation duplicated", "Could not duplicate"))}>
                      <ActIcon name="duplicate" />
                    </a>
                  ) : null}
                  {canDelete ? (
                    <a
                      href="#"
                      className="bbp-act is-danger"
                      data-tip="Delete"
                      aria-label="Delete"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (await confirm("Delete this presentation with its slides and statistics? This cannot be undone.")) void run(() => api(`presentations/${r.id}`, { method: "DELETE" }), "Presentation deleted", "Could not delete");
                      }}
                    >
                      <ActIcon name="delete" />
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
