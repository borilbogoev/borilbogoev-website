"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { del, get, message, patch, post, request } from "../lib/client";
import { REPORT_REASONS, RESERVED_SLUGS } from "../lib/constants";
import { t } from "../strings";
import { toast } from "../components/toast";

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const pill = (s: string) => <span className={`bbfa-pill bbfa-pill--${s === "open" || s === "active" || s === "published" ? "active" : s === "banned" || s === "hidden_by_mod" || s === "archived" ? "closed" : "draft"}`}>{s.replace(/_/g, " ")}</span>;

async function act(fn: () => Promise<unknown>, ok: string, then?: () => void): Promise<boolean> {
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

// ------------------------------------------------------------------ communities

export type CommunityRowData = { id: number; slug: string; name: string; visibility: string; joinMode: string; status: string; isDefault: boolean; members: number; posts: number };

export function CommunitiesTable({ rows }: { rows: CommunityRowData[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const move = async (i: number, d: -1 | 1) => {
    const order = rows.map((r) => r.id);
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await act(() => post("/api/admin/community/communities", { order }), "Order saved.", refresh);
  };
  return (
    <div className="bbfa-table-wrap cm-adm-wrap">
      <table className="bbfa-table">
        <thead>
          <tr><th>Name</th><th>Address</th><th>Visibility</th><th>Join</th><th>Status</th><th className="num">Members</th><th className="num">Posts</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td><strong>{r.name}</strong> {r.isDefault ? <span className="bbfa-pill bbfa-pill--active">Default</span> : null}</td>
              <td><code>/community/{r.slug}</code></td>
              <td>{r.visibility}</td>
              <td>{r.joinMode}</td>
              <td>{pill(r.status)}</td>
              <td className="num">{r.members}</td>
              <td className="num">{r.posts}</td>
              <td>
                <div className="cm-adm-actions">
                  <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${r.name} up`}>↑</button>
                  <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${r.name} down`}>↓</button>
                  <Link className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" href={`/admin/communities/${r.id}`}>Edit</Link>
                  <Link className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" href={`/admin/communities/${r.id}/members`}>Members</Link>
                  {!r.isDefault ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => act(() => patch(`/api/admin/community/communities/${r.id}`, { setDefault: true }), "Default community changed.", refresh)}>Make default</button> : null}
                  {!r.isDefault ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => act(() => patch(`/api/admin/community/communities/${r.id}`, { status: r.status === "archived" ? "active" : "archived" }), r.status === "archived" ? "Community restored." : "Community archived.", refresh)}>{r.status === "archived" ? "Unarchive" : "Archive"}</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type CommunityFormData = { id?: number; slug: string; name: string; description: string; iconUrl: string; coverUrl: string; visibility: string; joinMode: string; status: string };

export function CommunityForm({ initial }: { initial: CommunityFormData }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = !!initial.id;
  const set = (p: Partial<CommunityFormData>) => setV((c) => ({ ...c, ...p }));

  async function upload(kind: "icon" | "cover", file?: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    try {
      const r = await request<{ url: string }>("POST", "/api/admin/community/media", fd);
      set(kind === "icon" ? { iconUrl: r.url } : { coverUrl: r.url });
    } catch (e) {
      toast(message(e), "error");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing) await patch(`/api/admin/community/communities/${initial.id}`, v);
      else await post("/api/admin/community/communities", v);
      toast("Saved.");
      router.push("/admin/communities/list");
      router.refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cm-adm-form" onSubmit={submit}>
      <label><span className="cm-adm-label">Name</span><input type="text" required maxLength={80} value={v.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <label>
        <span className="cm-adm-label">Address</span>
        <input type="text" required disabled={editing} value={v.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} />
        <small className="bbfa-muted">{editing ? "The address cannot change after creation." : `Lowercase letters, numbers and hyphens. Reserved: ${RESERVED_SLUGS.slice(0, 6).join(", ")}...`}</small>
      </label>
      <label><span className="cm-adm-label">Description</span><textarea maxLength={600} value={v.description} onChange={(e) => set({ description: e.target.value })} /></label>
      <div className="row2">
        <label><span className="cm-adm-label">Icon</span>{v.iconUrl ? <img src={v.iconUrl} alt="" width={48} height={48} style={{ borderRadius: 12, display: "block", marginBottom: 6 }} /> : null}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload("icon", e.target.files?.[0])} />{v.iconUrl ? <button type="button" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => set({ iconUrl: "" })}>Remove</button> : null}</label>
        <label><span className="cm-adm-label">Cover</span>{v.coverUrl ? <img src={v.coverUrl} alt="" style={{ maxWidth: "100%", height: 64, objectFit: "cover", borderRadius: 12, display: "block", marginBottom: 6 }} /> : null}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload("cover", e.target.files?.[0])} />{v.coverUrl ? <button type="button" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => set({ coverUrl: "" })}>Remove</button> : null}</label>
      </div>
      <div className="row2">
        <label><span className="cm-adm-label">Visibility</span><select value={v.visibility} onChange={(e) => set({ visibility: e.target.value })}><option value="listed">Listed: everyone can see it</option><option value="hidden">Hidden: only members see it</option></select></label>
        <label><span className="cm-adm-label">Join mode</span><select value={v.joinMode} onChange={(e) => set({ joinMode: e.target.value })}><option value="open">Open: anyone signed in can join</option><option value="closed">Closed: an admin adds members</option></select></label>
      </div>
      <label><span className="cm-adm-label">Status</span><select value={v.status} onChange={(e) => set({ status: e.target.value })}><option value="active">Active</option><option value="archived">Archived: read only</option></select></label>
      {error ? <p className="bbfa-login__error" role="alert">{error}</p> : null}
      <div><button type="submit" className="bbfa-btn" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Create community"}</button> <Link href="/admin/communities/list" className="bbfa-btn bbfa-btn--ghost">Cancel</Link></div>
    </form>
  );
}

// ------------------------------------------------------------------ members

export type MemberData = { userId: string; name: string; username: string; email: string; role: string; status: string; bannedReason: string; joinedAt: string };

export function MembersManager({ communityId, initial, isSuper }: { communityId: number; initial: MemberData[]; isSuper: boolean }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; username: string | null; email: string }[]>([]);
  const [lookup, setLookup] = useState("");

  const load = async (query = q, st = status) => {
    try {
      const p = new URLSearchParams({ q: query, status: st });
      setRows((await get<{ items: MemberData[] }>(`/api/admin/community/communities/${communityId}/members?${p}`)).items);
    } catch (e) {
      toast(message(e), "error");
    }
  };
  const doAction = (action: string, userId: string, ok: string, reason?: string) => act(() => post(`/api/admin/community/communities/${communityId}/members`, { action, userId, reason }), ok, () => void load());

  async function search(v: string) {
    setLookup(v);
    if (v.trim().length < 2) return setFound([]);
    try {
      setFound((await get<{ items: typeof found }>(`/api/admin/community/users?q=${encodeURIComponent(v)}`)).items);
    } catch {
      setFound([]);
    }
  }

  return (
    <div>
      <div className="cm-adm-filters">
        <input type="search" placeholder="Search members" aria-label="Search members" value={q} onChange={(e) => { setQ(e.target.value); void load(e.target.value, status); }} />
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); void load(q, e.target.value); }}><option value="">Any status</option><option value="active">Active</option><option value="banned">Banned</option></select>
      </div>
      {isSuper ? (
        <div style={{ marginBottom: 20 }}>
          <label className="cm-adm-filters"><span className="bbfa-label">Add a member</span><input type="search" placeholder="Search users by name or email" value={lookup} onChange={(e) => void search(e.target.value)} /></label>
          {found.length ? (
            <ul className="cm-adm-results">
              {found.map((u) => (
                <li key={u.id}><button type="button" onClick={async () => { if (await doAction("add", u.id, `${u.name || u.email} added.`)) { setFound([]); setLookup(""); } }}>{u.name || u.email} <span className="bbfa-muted">{u.email}</span></button></li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="bbfa-table-wrap cm-adm-wrap">
        <table className="bbfa-table">
          <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={5} className="bbfa-table-empty"><strong>No members found.</strong></td></tr> : null}
            {rows.map((m) => (
              <tr key={m.userId}>
                <td><strong>{m.name}</strong><div className="bbfa-sub">{m.username ? `@${m.username}` : ""} {m.email}</div></td>
                <td>{m.role}</td>
                <td>{pill(m.status)}{m.bannedReason ? <div className="bbfa-sub">{m.bannedReason}</div> : null}</td>
                <td>{fmt(m.joinedAt)}</td>
                <td>
                  <div className="cm-adm-actions">
                    {isSuper && m.status === "active" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => doAction(m.role === "moderator" ? "remove_moderator" : "make_moderator", m.userId, m.role === "moderator" ? "Moderator removed." : "Moderator added.")}>{m.role === "moderator" ? "Remove moderator" : "Make moderator"}</button> : null}
                    {m.status === "active" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => { const reason = window.prompt("Reason for the ban (optional)") ; if (reason !== null) void doAction("ban", m.userId, "Member banned.", reason); }}>Ban</button> : <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => doAction("unban", m.userId, "Member unbanned.")}>Unban</button>}
                    {isSuper ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm bbfa-btn--danger-ghost" onClick={() => { if (window.confirm("Remove this member?")) void doAction("remove", m.userId, "Member removed."); }}>Remove</button> : null}
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

// ------------------------------------------------------------------ reports

export type ReportData = {
  id: number; status: string; targetType: string; targetId: string; communityId: number | null; communityName: string; reason: string; details: string; reporter: string; createdAt: string;
  preview: string; href: string; targetStatus: string; targetUserId: string; targetUserName: string; snapshot: string; resolution: string; canAct: boolean;
};

export function ReportsQueue({ initial, communities, isSuper }: { initial: ReportData[]; communities: { id: number; name: string }[]; isSuper: boolean }) {
  const [rows, setRows] = useState(initial);
  const [f, setF] = useState({ status: "open", type: "", communityId: "" });
  const load = async (next = f) => {
    try {
      const p = new URLSearchParams(Object.entries(next).filter(([, v]) => v));
      setRows((await get<{ items: ReportData[] }>(`/api/admin/community/reports?${p}`)).items);
    } catch (e) {
      toast(message(e), "error");
    }
  };
  const change = (p: Partial<typeof f>) => { const n = { ...f, ...p }; setF(n); void load(n); };
  const resolve = (r: ReportData, action: string, ok: string) => {
    const note = window.prompt("Note (optional)");
    if (note === null) return;
    void act(() => post(`/api/admin/community/reports/${r.id}`, { action, note }), ok, () => void load());
  };
  return (
    <div>
      <div className="cm-adm-filters">
        <select aria-label="Status" value={f.status} onChange={(e) => change({ status: e.target.value })}><option value="">Any status</option><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>
        <select aria-label="Type" value={f.type} onChange={(e) => change({ type: e.target.value })}><option value="">Any type</option><option value="post">Posts</option><option value="comment">Comments</option><option value="message">Messages</option><option value="user">People</option></select>
        <select aria-label="Community" value={f.communityId} onChange={(e) => change({ communityId: e.target.value })}><option value="">All communities</option>{communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="bbfa-table-wrap cm-adm-wrap">
        <table className="bbfa-table">
          <thead><tr><th>Report</th><th>Reported</th><th>Reporter</th><th>Date</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={5} className="bbfa-table-empty"><strong>Nothing in the queue.</strong></td></tr> : null}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{t.report.reasons[r.reason as (typeof REPORT_REASONS)[number]] ?? r.reason}</strong> {pill(r.status)}
                  <div className="bbfa-sub">{r.targetType}{r.communityName ? ` · ${r.communityName}` : ""}</div>
                  {r.details ? <p className="cm-adm-quote">&ldquo;{r.details}&rdquo;</p> : null}
                  {r.resolution ? <div className="bbfa-sub">Resolution: {r.resolution}</div> : null}
                </td>
                <td>
                  <p className="cm-adm-quote">{r.preview}</p>
                  <div className="bbfa-sub">{r.targetUserName ? `By ${r.targetUserName}` : ""}{r.targetStatus && r.targetStatus !== "published" ? ` · ${r.targetStatus.replace(/_/g, " ")}` : ""}</div>
                  {r.snapshot ? <p className="cm-adm-snapshot">{r.snapshot}</p> : null}
                  {r.href ? <Link href={r.href} target="_blank" className="bbfa-sub">Open ↗</Link> : null}
                </td>
                <td>{r.reporter}</td>
                <td>{fmt(r.createdAt)}</td>
                <td>
                  {r.canAct ? (
                    <div className="cm-adm-actions">
                      <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => resolve(r, "dismiss", "Report dismissed.")}>Dismiss</button>
                      {r.targetType === "post" || r.targetType === "comment" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => resolve(r, "hide", "Content hidden.")}>Hide</button> : null}
                      {r.targetType === "post" || r.targetType === "comment" || (r.targetType === "message" && isSuper) ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => resolve(r, "delete", "Content deleted.")}>Delete</button> : null}
                      {r.communityId && r.targetUserId ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => resolve(r, "ban", "Member banned.")}>Ban from community</button> : null}
                      {isSuper && r.targetUserId ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm bbfa-btn--danger-ghost" onClick={() => resolve(r, "suspend", "User suspended.")}>Suspend</button> : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ content tools

type ContentRow = { kind: "post" | "comment"; id: number; postId: number; author: string; snippet: string; status: string; createdAt: string };

export function ContentTools({ communities }: { communities: { id: number; name: string; slug: string }[] }) {
  const [communityId, setCommunityId] = useState(String(communities[0]?.id ?? ""));
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ContentRow[] | null>(null);
  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      setRows((await get<{ items: ContentRow[] }>(`/api/admin/community/content?communityId=${communityId}&q=${encodeURIComponent(q)}`)).items);
    } catch (err) {
      toast(message(err), "error");
    }
  };
  const slug = communities.find((c) => String(c.id) === communityId)?.slug ?? "";
  const moderate = (r: ContentRow, status: string, ok: string) => act(() => post("/api/admin/community/content", { kind: r.kind, id: r.id, status }), ok, () => void search());
  return (
    <div>
      <form className="cm-adm-filters" onSubmit={search}>
        <select aria-label="Community" value={communityId} onChange={(e) => setCommunityId(e.target.value)}>{communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input type="search" aria-label="Search" placeholder="Post or comment id, or text" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="bbfa-btn bbfa-btn--sm" type="submit">Search</button>
      </form>
      {rows ? (
        <div className="bbfa-table-wrap cm-adm-wrap">
          <table className="bbfa-table">
            <thead><tr><th>Item</th><th>Author</th><th>Status</th><th>Date</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={5} className="bbfa-table-empty"><strong>Nothing found.</strong></td></tr> : null}
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`}>
                  <td><span className="bbfa-sub">{r.kind} #{r.id}</span><p className="cm-adm-quote">{r.snippet || "(no text)"}</p></td>
                  <td>{r.author}</td>
                  <td>{pill(r.status)}</td>
                  <td>{fmt(r.createdAt)}</td>
                  <td>
                    <div className="cm-adm-actions">
                      <Link className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" target="_blank" href={`/community/${slug}/post/${r.postId}${r.kind === "comment" ? `#comment-${r.id}` : ""}`}>Open</Link>
                      {r.status === "published" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => moderate(r, "hidden_by_mod", "Hidden.")}>Hide</button> : null}
                      {r.status === "hidden_by_mod" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => moderate(r, "published", "Visible again.")}>Show</button> : null}
                      {r.status !== "deleted" ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm bbfa-btn--danger-ghost" onClick={() => { if (window.confirm("Delete this item?")) void moderate(r, "deleted", "Deleted."); }}>Delete</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="bbfa-muted">Pick a community and search. Leave the search empty to see the latest.</p>}
    </div>
  );
}

// ------------------------------------------------------------------ settings

export type SettingsData = { postingPaused: boolean; maxImagesPerPost: number; maxImageMb: number; ratePostPerHour: number; rateCommentPerHour: number; rateMessagePerMinute: number };

export function SettingsForm({ initial, updatedBy, updatedAt }: { initial: SettingsData; updatedBy: string; updatedAt: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const num = (key: keyof SettingsData, label: string, min: number, max: number) => (
    <label><span className="cm-adm-label">{label}</span><input type="number" min={min} max={max} value={v[key] as number} onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })} /></label>
  );
  return (
    <form className="cm-adm-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); await act(() => request("PUT", "/api/admin/community/settings", v), "Settings saved. They apply within 30 seconds.", () => router.refresh()); setBusy(false); }}>
      <label className="cm-adm-check"><input type="checkbox" checked={v.postingPaused} onChange={(e) => setV({ ...v, postingPaused: e.target.checked })} /> Pause posting and commenting everywhere (messages keep working)</label>
      <div className="row2">{num("maxImagesPerPost", "Images per post", 0, 10)}{num("maxImageMb", "Largest image (MB)", 1, 25)}</div>
      <div className="row2">{num("ratePostPerHour", "Posts per hour, per person", 1, 1000)}{num("rateCommentPerHour", "Comments per hour, per person", 1, 5000)}</div>
      <div className="row2">{num("rateMessagePerMinute", "Messages per minute, per person", 1, 600)}</div>
      <p className="bbfa-muted">{updatedAt ? `Last changed ${fmt(updatedAt)}${updatedBy ? ` by ${updatedBy}` : ""}.` : "Not changed yet."} The Superadmin is exempt from rate limits.</p>
      <div><button className="bbfa-btn" type="submit" disabled={busy}>{busy ? "Saving..." : "Save settings"}</button></div>
    </form>
  );
}

// ------------------------------------------------------------------ suspensions

export type SuspensionData = { id: number; userId: string; name: string; email: string; reason: string; createdAt: string; liftedAt: string | null };

export function SuspensionsManager({ initial }: { initial: SuspensionData[] }) {
  const router = useRouter();
  const [lookup, setLookup] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; username: string | null; email: string }[]>([]);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  async function search(v: string) {
    setLookup(v);
    if (v.trim().length < 2) return setFound([]);
    try { setFound((await get<{ items: typeof found }>(`/api/admin/community/users?q=${encodeURIComponent(v)}`)).items); } catch { setFound([]); }
  }
  return (
    <div>
      <div className="cm-adm-form" style={{ marginBottom: 24 }}>
        <label><span className="cm-adm-label">Suspend a user</span><input type="text" placeholder="Search by name or email" value={target ? target.name : lookup} onChange={(e) => { setTarget(null); void search(e.target.value); }} /></label>
        {!target && found.length ? <ul className="cm-adm-results">{found.map((u) => <li key={u.id}><button type="button" onClick={() => { setTarget({ id: u.id, name: u.name || u.email }); setFound([]); }}>{u.name || u.email} <span className="bbfa-muted">{u.email}</span></button></li>)}</ul> : null}
        <label><span className="cm-adm-label">Reason</span><input type="text" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div><button className="bbfa-btn" disabled={!target} onClick={async (e) => { e.preventDefault(); if (target && (await act(() => post("/api/admin/community/suspensions", { userId: target.id, reason }), "User suspended.", () => router.refresh()))) { setTarget(null); setLookup(""); setReason(""); } }}>Suspend</button></div>
      </div>
      <div className="bbfa-table-wrap cm-adm-wrap">
        <table className="bbfa-table">
          <thead><tr><th>User</th><th>Reason</th><th>Since</th><th>Status</th><th /></tr></thead>
          <tbody>
            {initial.length === 0 ? <tr><td colSpan={5} className="bbfa-table-empty"><strong>No suspensions.</strong></td></tr> : null}
            {initial.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name || s.email}</strong><div className="bbfa-sub">{s.email}</div></td>
                <td>{s.reason}</td>
                <td>{fmt(s.createdAt)}</td>
                <td>{s.liftedAt ? <>{pill("lifted")} <span className="bbfa-sub">{fmt(s.liftedAt)}</span></> : pill("active")}</td>
                <td>{!s.liftedAt ? <button className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => act(() => del(`/api/admin/community/suspensions?id=${s.id}`), "Suspension lifted.", () => router.refresh())}>Lift</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
