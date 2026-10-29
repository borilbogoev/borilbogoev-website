"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/modules/account/components/ui";
import { del, message, patch, type People, type Post } from "../lib/client";
import { LIMITS } from "../lib/constants";
import { toEditable } from "../lib/text";
import { t } from "../strings";
import { LikeButton } from "./like-button";
import { ImageGrid } from "./image-grid";
import { MentionText } from "./mention-text";
import { emptyMention, MentionTextarea, stored, type MentionValue } from "./mention-textarea";
import { Menu, type MenuItem } from "./menu";
import { RelativeTime } from "./relative-time";
import { ReportDialog } from "./report-dialog";
import { StartChatButton } from "./user-actions";
import { toast } from "./toast";

export function AuthorLine({ person, time, edited, hidden, meId }: { person: { id: string; name: string; username: string; avatarUrl: string }; time: string; edited?: boolean; hidden?: boolean; meId?: string }) {
  return (
    <div className="cm-author">
      <Avatar name={person.name} url={person.avatarUrl} size={40} />
      <div className="cm-author__text">
        <Link href={`/community/u/${person.id}`} className="cm-author__name">
          {person.name}
        </Link>
        <span className="cm-muted">
          <RelativeTime iso={time} />
          {edited ? ` · ${t.post.edited}` : ""}
          {hidden ? ` · ${t.post.hidden}` : ""}
        </span>
      </div>
      {meId && meId !== person.id ? <span className="cm-author__chat"><StartChatButton userId={person.id} className="cm-link-btn" label={t.action.message} /></span> : null}
    </div>
  );
}

export function PostCard({
  post: initial,
  people,
  slug,
  communityId,
  meId,
  detail = false,
  onRemoved,
}: {
  post: Post;
  people: People;
  slug: string;
  communityId: number;
  meId: string;
  detail?: boolean;
  onRemoved?: (id: number) => void;
}) {
  const [post, setPost] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<MentionValue>(emptyMention());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(false);
  const [localPeople, setLocalPeople] = useState(people);

  const items: MenuItem[] = [];
  if (post.canEdit) items.push({ label: t.action.edit, onSelect: () => { setValue(toEditable(post.body)); setEditing(true); setError(""); } });
  if (post.canModerate && post.status === "published") items.push({ label: t.action.hide, onSelect: () => void moderate("hidden_by_mod") });
  if (post.canModerate && post.status === "hidden_by_mod") items.push({ label: t.action.unhide, onSelect: () => void moderate("published") });
  if (post.canDelete) items.push({ label: t.action.delete, danger: true, onSelect: () => void remove() });
  if (!post.mine) items.push({ label: t.action.report, onSelect: () => setReport(true) });

  async function moderate(status: "hidden_by_mod" | "published") {
    try {
      await patch(`/api/community/posts/${post.id}`, { status });
      if (status === "hidden_by_mod") onRemoved?.(post.id);
      else setPost({ ...post, status });
      toast(status === "hidden_by_mod" ? "Post hidden." : "Post is visible again.");
    } catch (e) {
      toast(message(e), "error");
    }
  }
  async function remove() {
    if (!window.confirm(t.post.confirmDelete)) return;
    try {
      await del(`/api/community/posts/${post.id}`);
      onRemoved?.(post.id);
      toast("Post deleted.");
    } catch (e) {
      toast(message(e), "error");
    }
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await patch<{ item: Post; people: People }>(`/api/community/posts/${post.id}`, { body: stored(value) });
      setPost(res.item);
      setLocalPeople({ ...localPeople, ...res.people });
      setEditing(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const tags = post.status === "hidden_by_mod";
  return (
    <article className={`cm-card cm-post${tags ? " is-hidden" : ""}`} id={`post-${post.id}`}>
      <div className="cm-post__head">
        <AuthorLine person={post.author} time={post.createdAt} edited={!!post.editedAt} hidden={tags} meId={meId} />
        <Menu items={items} />
      </div>
      {editing ? (
        <div className="cm-edit">
          <MentionTextarea value={value} onChange={setValue} communityId={communityId} label="Edit post" maxLength={LIMITS.postBody} rows={4} autoFocus />
          {error ? <p className="cm-error" role="alert">{error}</p> : null}
          <div className="cm-actions">
            <button type="button" className="bb-btn bb-btn-outline cm-btn-sm" onClick={() => setEditing(false)}>{t.action.cancel}</button>
            <button type="button" className="bb-btn bb-btn-primary cm-btn-sm" onClick={save} disabled={busy}>{busy ? t.action.saving : t.action.save}</button>
          </div>
        </div>
      ) : post.body ? (
        <MentionText body={post.body} people={localPeople} />
      ) : null}
      <ImageGrid media={post.media} />
      <div className="cm-post__foot">
        <LikeButton type="post" id={post.id} liked={post.liked} count={post.likeCount} />
        {detail ? (
          <span className="cm-muted">{t.post.comments(post.commentCount)}</span>
        ) : (
          <Link href={`/community/${slug}/post/${post.id}`} className="cm-link-btn">
            {t.post.comments(post.commentCount)}
          </Link>
        )}
      </div>
      <ReportDialog target={report ? { type: "post", id: post.id } : null} onClose={() => setReport(false)} />
    </article>
  );
}


