"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/modules/account/components/ui";
import { api, del, message, newRequestId, patch, post as postJson, type Comment, type People, type Person } from "../lib/client";
import { LIMITS, POLL } from "../lib/constants";
import { usePolling } from "../hooks/use-polling";
import { toEditable } from "../lib/text";
import { t } from "../strings";
import { LikeButton } from "./like-button";
import { MentionText } from "./mention-text";
import { emptyMention, MentionTextarea, stored, type MentionValue } from "./mention-textarea";
import { Menu, type MenuItem } from "./menu";
import { RelativeTime } from "./relative-time";
import { ReportDialog } from "./report-dialog";
import { toast } from "./toast";

type Row = Comment & { pending?: boolean };

/** Comments of one post: oldest first, own comments appear at once, new ones from others arrive by polling. */
export function CommentSection({
  postId,
  communityId,
  me,
  initial,
  initialPeople,
  initialNext,
  initialCount,
  canComment,
  blockedReason,
}: {
  postId: number;
  communityId: number;
  me: Person;
  initial: Comment[];
  initialPeople: People;
  initialNext: string | null;
  initialCount: number;
  canComment: boolean;
  blockedReason: string;
}) {
  const [items, setItems] = useState<Row[]>(initial);
  const [people, setPeople] = useState<People>({ ...initialPeople, [me.id]: me });
  const [next, setNext] = useState(initialNext);
  const [count, setCount] = useState(initialCount);
  const [waiting, setWaiting] = useState<Comment[]>([]);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  // Newest comment seen from the server. Own comments do not move it, so a comment by someone else that landed first is never skipped.
  const seen = useRef(initial.filter((c) => !c.mine).at(-1)?.cursor ?? initial.at(-1)?.cursor ?? null);
  const endRef = useRef<HTMLDivElement>(null);

  const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;

  const merge = (cur: Row[], add: Comment[]) => {
    const have = new Set(cur.map((c) => c.id));
    return [...cur, ...add.filter((c) => !have.has(c.id))];
  };

  usePolling(
    async (signal) => {
      if (next) return; // more pages to load first
      const r = await api.commentUpdates(postId, seen.current, signal);
      setCount(r.commentCount);
      const fresh = r.items.filter((c) => !items.some((x) => x.id === c.id));
      if (r.items.length) seen.current = r.items.filter((c) => !c.mine).at(-1)?.cursor ?? seen.current;
      setPeople((p) => ({ ...p, ...r.people }));
      if (!fresh.length) return;
      if (nearBottom()) setItems((cur) => merge(cur, fresh));
      else setWaiting((w) => [...w, ...fresh.filter((c) => !w.some((x) => x.id === c.id))]);
    },
    { intervalMs: POLL.comments, key: postId },
  );

  function showWaiting() {
    setItems((cur) => merge(cur, waiting));
    setWaiting([]);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  async function more() {
    if (!next) return;
    setLoadingMore(true);
    try {
      const r = await api.comments(postId, next);
      setItems((cur) => merge(cur, r.items));
      setPeople((p) => ({ ...p, ...r.people }));
      seen.current = r.items.filter((c) => !c.mine).at(-1)?.cursor ?? seen.current;
      setNext(r.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // jump to a comment from a notification link
  useEffect(() => {
    if (location.hash.startsWith("#comment-")) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, []);

  async function create(v: MentionValue, requestId: string) {
    const body = stored(v);
    const tempId = -Date.now();
    const temp: Row = { id: tempId, postId, author: me, body, createdAt: new Date().toISOString(), editedAt: null, likeCount: 0, liked: false, status: "published", cursor: "", mine: true, canEdit: false, canDelete: false, canModerate: false, pending: true };
    setPeople((p) => ({ ...p, ...Object.fromEntries(v.picks.map((k) => [k.userId, { id: k.userId, name: k.name, username: "", avatarUrl: "" }])), [me.id]: me }));
    setItems((cur) => [...cur, temp]);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    try {
      const res = await postJson<{ item: Comment; people: People; duplicate: boolean }>(`/api/community/posts/${postId}/comments`, { body, requestId });
      setItems((cur) => {
        const without = cur.filter((c) => c.id !== tempId);
        return without.some((c) => c.id === res.item.id) ? without : [...without, res.item];
      });
      setPeople((p) => ({ ...p, ...res.people }));
      if (!res.duplicate) setCount((n) => n + 1);
      return true;
    } catch (e) {
      setItems((cur) => cur.filter((c) => c.id !== tempId));
      throw e;
    }
  }

  return (
    <section className="cm-comments" aria-label="Comments">
      <h2 className="cm-comments__title">{t.post.comments(count)}</h2>
      {items.length === 0 ? <p className="cm-muted">{t.comment.none}</p> : null}
      <ol className="cm-comment-list">
        {items.map((c) => (
          <CommentItem key={c.id} c={c} people={people} communityId={communityId} onRemoved={(id) => { setItems((cur) => cur.filter((x) => x.id !== id)); setCount((n) => Math.max(0, n - 1)); }} onChanged={(n) => setItems((cur) => cur.map((x) => (x.id === n.id ? n : x)))} />
        ))}
      </ol>
      <div ref={endRef} />
      {next ? (
        <div className="cm-more">
          <button type="button" className="bb-btn bb-btn-outline" onClick={more} disabled={loadingMore}>{t.action.loadMore}</button>
        </div>
      ) : null}
      {error ? <p className="cm-error" role="alert">{error} <button type="button" className="cm-link-btn" onClick={more}>{t.action.retry}</button></p> : null}
      <div className="cm-pill-wrap cm-pill-wrap--bottom" aria-live="polite">
        {waiting.length ? <button type="button" className="cm-pill" onClick={showWaiting}>{t.feed.newComments(waiting.length)}</button> : null}
      </div>
      {canComment ? <CommentComposer communityId={communityId} onSubmit={create} /> : blockedReason ? <p className="cm-note">{blockedReason}</p> : null}
    </section>
  );
}

function CommentComposer({ communityId, onSubmit }: { communityId: number; onSubmit: (v: MentionValue, requestId: string) => Promise<boolean> }) {
  const [value, setValue] = useState<MentionValue>(emptyMention());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(newRequestId());

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !value.text.trim()) return;
    setBusy(true);
    setError("");
    const draft = value;
    setValue(emptyMention());
    try {
      await onSubmit(draft, requestId.current);
      requestId.current = newRequestId();
    } catch (err) {
      setValue(draft);
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cm-card cm-composer" onSubmit={submit} aria-label="New comment">
      <MentionTextarea value={value} onChange={setValue} communityId={communityId} label="Write a comment" placeholder={t.composer.commentPlaceholder} maxLength={LIMITS.commentBody} rows={2} onSubmitShortcut={() => void submit()} />
      {error ? <p className="cm-error" role="alert">{error}</p> : null}
      <div className="cm-composer__bar">
        <span className="cm-muted cm-count">{t.composer.count(value.text.length, LIMITS.commentBody)}</span>
        <button type="submit" className="bb-btn bb-btn-primary" disabled={busy || !value.text.trim()}>{busy ? t.action.sending : t.action.comment}</button>
      </div>
    </form>
  );
}

function CommentItem({ c, people, communityId, onRemoved, onChanged }: { c: Row; people: People; communityId: number; onRemoved: (id: number) => void; onChanged: (c: Comment) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<MentionValue>(emptyMention());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(false);
  const [localPeople, setLocalPeople] = useState(people);

  const items: MenuItem[] = [];
  if (c.canEdit) items.push({ label: t.action.edit, onSelect: () => { setValue(toEditable(c.body)); setEditing(true); } });
  if (c.canModerate && c.status === "published") items.push({ label: t.action.hide, onSelect: async () => { try { await patch(`/api/community/comments/${c.id}`, { status: "hidden_by_mod" }); onRemoved(c.id); } catch (e) { toast(message(e), "error"); } } });
  if (c.canDelete) items.push({ label: t.action.delete, danger: true, onSelect: async () => { if (!window.confirm(t.comment.confirmDelete)) return; try { await del(`/api/community/comments/${c.id}`); onRemoved(c.id); } catch (e) { toast(message(e), "error"); } } });
  if (!c.mine && c.id > 0) items.push({ label: t.action.report, onSelect: () => setReport(true) });

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await patch<{ item: Comment; people: People }>(`/api/community/comments/${c.id}`, { body: stored(value) });
      setLocalPeople({ ...localPeople, ...res.people });
      onChanged(res.item);
      setEditing(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const author = people[c.author.id] ?? c.author;
  return (
    <li id={`comment-${c.id}`} className={`cm-comment${c.pending ? " is-pending" : ""}${c.status === "hidden_by_mod" ? " is-hidden" : ""}`}>
      <Avatar name={author.name} url={author.avatarUrl} size={32} />
      <div className="cm-comment__main">
        <div className="cm-comment__head">
          <Link href={`/community/u/${author.id}`} className="cm-author__name">{author.name}</Link>
          <span className="cm-muted">
            <RelativeTime iso={c.createdAt} />
            {c.editedAt ? ` · ${t.post.edited}` : ""}
            {c.status === "hidden_by_mod" ? ` · ${t.comment.hidden}` : ""}
          </span>
          {c.pending ? null : <Menu items={items} />}
        </div>
        {editing ? (
          <div className="cm-edit">
            <MentionTextarea value={value} onChange={setValue} communityId={communityId} label="Edit comment" maxLength={LIMITS.commentBody} rows={3} autoFocus />
            {error ? <p className="cm-error" role="alert">{error}</p> : null}
            <div className="cm-actions">
              <button type="button" className="bb-btn bb-btn-outline cm-btn-sm" onClick={() => setEditing(false)}>{t.action.cancel}</button>
              <button type="button" className="bb-btn bb-btn-primary cm-btn-sm" onClick={save} disabled={busy}>{busy ? t.action.saving : t.action.save}</button>
            </div>
          </div>
        ) : (
          <MentionText body={c.body} people={localPeople} />
        )}
        {c.pending || editing ? null : <div className="cm-comment__foot"><LikeButton type="comment" id={c.id} liked={c.liked} count={c.likeCount} /></div>}
      </div>
      <ReportDialog target={report ? { type: "comment", id: c.id } : null} onClose={() => setReport(false)} />
    </li>
  );
}
