"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HighlightIcon } from "../components/highlight-icon";
import { toast } from "../components/toast";
import { del, get, message, patch, post, request, type Category } from "../lib/client";
import { SORT_HELP, SORT_LABELS, SORT_RULES } from "../lib/constants";
import type { Highlight } from "../lib/rich";

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

async function act(fn: () => Promise<unknown>, ok: string, then?: () => void) {
  try {
    await fn();
    toast(ok);
    then?.();
    return true;
  } catch (e) {
    toast(message(e), "error");
    return false;
  }
}

// ------------------------------------------------------------------ rich posts

export type RichRow = {
  id: number; title: string; excerpt: string; status: string; pinned: boolean; commentsLocked: boolean; communityId: number; communityName: string; communitySlug: string;
  categoryName: string; likes: number; comments: number; cover: string; highlights: Highlight[]; blocks: number; updatedAt: string;
};

export function RichPostsTable({ rows, communities }: { rows: RichRow[]; communities: { id: number; name: string }[] }) {
  const router = useRouter();
  const [community, setCommunity] = useState("");
  const [status, setStatus] = useState("");
  const refresh = () => router.refresh();
  const shown = rows.filter((r) => (!community || String(r.communityId) === community) && (!status || r.status === status));
  const pill = (s: string) => <span className={`bbfa-pill bbfa-pill--${s === "published" ? "active" : s === "hidden_by_mod" ? "closed" : "draft"}`}>{s === "hidden_by_mod" ? "hidden" : s}</span>;
  return (
    <div>
      <div className="cm-adm-filters">
        <select aria-label="Community" value={community} onChange={(e) => setCommunity(e.target.value)}>
          <option value="">All communities</option>
          {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option><option value="published">Published</option><option value="draft">Draft</option><option value="hidden_by_mod">Hidden</option>
        </select>
      </div>
      <div className="bbfa-table-wrap cm-adm-wrap">
        <table className="bbfa-table">
          <thead><tr><th>Post</th><th>Where</th><th>Status</th><th className="num">Likes</th><th className="num">Comments</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {shown.length === 0 ? <tr><td colSpan={7} className="bbfa-table-empty"><strong>No rich posts yet.</strong>Build one with blocks, like a landing page, and publish it in a community.</td></tr> : null}
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="cm-adm-item">
                    {r.cover ? <img className="cm-adm-thumb" src={r.cover} alt="" width={56} height={56} loading="lazy" /> : <span className="cm-adm-thumb" aria-hidden="true" />}
                    <div>
                      <Link href={`/admin/communities/posts/${r.id}`} className="bbfa-forms__title">{r.title || "Untitled post"}</Link>
                      <div className="bbfa-sub">{r.blocks} blocks{r.pinned ? " · pinned" : ""}{r.commentsLocked ? " · comments off" : ""}</div>
                      {r.highlights.length ? <div className="cm-adm-hl">{r.highlights.map((h) => <span key={h.label}><HighlightIcon name={h.icon} size={12} /> {h.label}</span>)}</div> : null}
                    </div>
                  </div>
                </td>
                <td>{r.communityName}{r.categoryName ? <div className="bbfa-sub">{r.categoryName}</div> : null}</td>
                <td>{pill(r.status)}</td>
                <td className="num">{r.likes}</td>
                <td className="num">{r.comments}</td>
                <td>{fmt(r.updatedAt)}</td>
                <td>
                  <div className="cm-adm-actions">
                    <Link className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" href={`/admin/communities/posts/${r.id}`}>Edit</Link>
                    <Link className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" href={`/community/${r.communitySlug}/post/${r.id}`} target="_blank">{r.status === "published" ? "View" : "Preview"}</Link>
                    {r.status === "published" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => act(() => patch(`/api/community/posts/${r.id}`, { pinned: !r.pinned }), r.pinned ? "Unpinned." : "Pinned to the feed.", refresh)}>{r.pinned ? "Unpin" : "Pin"}</button> : null}
                    {r.status !== "hidden_by_mod" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => act(() => request("PUT", `/api/admin/community/rich/${r.id}`, { status: r.status === "published" ? "draft" : "published" }), r.status === "published" ? "Moved to drafts." : "Published.", refresh)}>{r.status === "published" ? "Unpublish" : "Publish"}</button> : null}
                    <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => act(() => patch(`/api/community/posts/${r.id}`, { commentsLocked: !r.commentsLocked }), r.commentsLocked ? "Comments are on." : "Comments are off.", refresh)}>{r.commentsLocked ? "Comments on" : "Comments off"}</button>
                    <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm bbfa-btn--danger-ghost" onClick={() => { if (window.confirm("Delete this post? Its comments and likes go with it.")) void act(() => del(`/api/community/posts/${r.id}`), "Post deleted.", refresh); }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NewRichForm({ communities, categories, initialCommunity, initialCategory }: { communities: { id: number; name: string }[]; categories: Category[]; initialCommunity: number; initialCategory: number | null }) {
  const router = useRouter();
  const [communityId, setCommunityId] = useState(initialCommunity || communities[0]?.id || 0);
  const [categoryId, setCategoryId] = useState<number | null>(initialCategory);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const cats = categories.filter((c) => c.communityId === communityId);
  return (
    <form
      className="cm-adm-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await post<{ id: number }>("/api/admin/community/rich", { communityId, categoryId, title });
          router.push(`/admin/communities/posts/${r.id}`);
        } catch (err) {
          toast(message(err), "error");
          setBusy(false);
        }
      }}
    >
      <label><span className="cm-adm-label">Title</span><input type="text" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is this post about?" autoFocus /></label>
      <div className="row2">
        <label><span className="cm-adm-label">Community</span><select value={communityId} onChange={(e) => { setCommunityId(Number(e.target.value)); setCategoryId(null); }}>{communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="cm-adm-label">Category</span><select value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "draft" ? " (draft)" : ""}</option>)}</select></label>
      </div>
      <div><button className="bbfa-btn" type="submit" disabled={busy}>{busy ? "Creating..." : "Open the builder"}</button> <Link href="/admin/communities/posts" className="bbfa-btn bbfa-btn--ghost">Cancel</Link></div>
    </form>
  );
}

// ------------------------------------------------------------------ categories

export function CategoriesManager({ communityId, initial }: { communityId: number; initial: Category[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const reload = async () => setRows((await get<{ items: Category[] }>(`/api/admin/community/communities/${communityId}/categories`)).items);
  const update = (c: Category, body: Record<string, unknown>, ok: string) => act(() => patch(`/api/admin/community/categories/${c.id}`, body), ok, () => void reload());
  const move = async (i: number, d: -1 | 1) => {
    const order = rows.map((r) => r.id);
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await act(() => post(`/api/admin/community/communities/${communityId}/categories`, { order }), "Order saved.", () => void reload());
  };
  return (
    <div>
      <form className="cm-adm-filters" onSubmit={async (e) => { e.preventDefault(); if (name.trim() && (await act(() => post(`/api/admin/community/communities/${communityId}/categories`, { name, status: "published" }), "Category created and published.", () => void reload()))) setName(""); }}>
        <input type="text" aria-label="New category" placeholder="New category name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="bbfa-btn bbfa-btn--sm" type="submit" disabled={!name.trim()}>+ Add category</button>
      </form>
      <div className="bbfa-table-wrap cm-adm-wrap">
        <table className="bbfa-table">
          <thead><tr><th>Name</th><th>Status</th><th>Default sorting</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={4} className="bbfa-table-empty"><strong>No categories yet.</strong>Published categories appear as tabs in the feed.</td></tr> : null}
            {rows.map((c, i) => (
              <tr key={c.id}>
                <td><input type="text" defaultValue={c.name} maxLength={40} aria-label={`Name of ${c.name}`} style={{ height: 36, border: "1.5px solid var(--bbfa-line2)", borderRadius: 10, padding: "0 10px", font: "600 14px var(--bbfa-font)", width: "100%", minWidth: 160 }} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) void update(c, { name: v }, "Renamed."); }} /><div className="bbfa-sub">?category={c.slug}</div></td>
                <td>
                  <span className={`bbfa-pill bbfa-pill--${c.status === "published" ? "active" : "draft"}`}>{c.status === "published" ? "Published" : "Draft"}</span>
                </td>
                <td>
                  <select aria-label={`Sorting of ${c.name}`} value={c.sortRule} onChange={(e) => void update(c, { sortRule: e.target.value }, "Sorting saved.")} style={{ height: 36, borderRadius: 999, border: "1.5px solid var(--bbfa-line2)", padding: "0 12px", font: "600 13px var(--bbfa-font)", background: "#fff" }}>
                    {SORT_RULES.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}: {SORT_HELP[s].toLowerCase()}</option>)}
                  </select>
                </td>
                <td>
                  <div className="cm-adm-actions">
                    <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} left`}>↑</button>
                    <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} right`}>↓</button>
                    <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => update(c, { status: c.status === "published" ? "draft" : "published" }, c.status === "published" ? "Moved to drafts." : "Published.")}>{c.status === "published" ? "Unpublish" : "Publish"}</button>
                    <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm bbfa-btn--danger-ghost" onClick={() => { if (window.confirm(`Delete "${c.name}"? Its posts stay, without a category.`)) void act(() => del(`/api/admin/community/categories/${c.id}`), "Category deleted.", () => void reload()); }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
