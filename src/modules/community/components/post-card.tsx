"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/modules/account/components/ui";
import { del, message, patch, post as postJson, type Category, type People, type Post } from "../lib/client";
import { LIMITS } from "../lib/constants";
import { toEditable } from "../lib/text";
import { t } from "../strings";
import { HighlightIcon } from "./highlight-icon";
import { ImageGrid } from "./image-grid";
import { LikeButton } from "./like-button";
import { RichSnippet } from "./rich-snippet";
import { MentionText } from "./mention-text";
import { emptyMention, MentionTextarea, stored, type MentionValue } from "./mention-textarea";
import { Dialog, Menu, type MenuItem } from "./menu";
import { RelativeTime } from "./relative-time";
import { ReportDialog } from "./report-dialog";
import { StartChatButton } from "./user-actions";
import { toast } from "./toast";

export function AuthorLine({ person, time, edited, hidden, meId, inverse }: { person: { id: string; name: string; username: string; avatarUrl: string }; time: string; edited?: boolean; hidden?: boolean; meId?: string; inverse?: boolean }) {
  return (
    <div className="cm-author">
      <Avatar name={person.name} url={person.avatarUrl} size={40} />
      <div className="cm-author__text">
        <Link href={`/community/u/${person.id}`} className="cm-author__name">
          {person.name}
        </Link>
        <span className={inverse ? "cm-muted-inv" : "cm-muted"}>
          <RelativeTime iso={time} />
          {edited ? ` · ${t.post.edited}` : ""}
          {hidden ? ` · ${t.post.hidden}` : ""}
        </span>
      </div>
      {meId && meId !== person.id ? <span className="cm-author__chat"><StartChatButton userId={person.id} className="cm-link-btn" label={t.action.message} /></span> : null}
    </div>
  );
}

/**
 * One post: a regular post, or (for the SuperAdmin's rich posts) a snippet in the feed and the built page in detail.
 * The menu carries every control: edit, copy link, category, pin, comments on or off, hide, delete, report, ban.
 */
export function PostCard({
  post: initial,
  people,
  slug,
  communityId,
  meId,
  categories = [],
  detail = false,
  onRemoved,
  children,
}: {
  post: Post;
  people: People;
  slug: string;
  communityId: number;
  meId: string;
  categories?: Category[];
  detail?: boolean;
  onRemoved?: (id: number) => void;
  /** Rich posts in detail: the rendered blocks. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<MentionValue>(emptyMention());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [cat, setCat] = useState(String(initial.categoryId ?? ""));
  const [localPeople, setLocalPeople] = useState(people);

  const href = `/community/${slug}/post/${post.id}`;
  const rich = post.kind === "rich";
  const category = categories.find((c) => c.id === post.categoryId);

  async function meta(body: Record<string, unknown>, ok: string, reload = false) {
    try {
      await patch(`/api/community/posts/${post.id}`, body);
      toast(ok);
      if (reload) window.location.reload();
      return true;
    } catch (e) {
      toast(message(e), "error");
      return false;
    }
  }
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
      if (detail) router.push(`/community/${slug}`);
    } catch (e) {
      toast(message(e), "error");
    }
  }
  async function ban() {
    const reason = window.prompt("Reason for the ban (optional)");
    if (reason === null) return;
    try {
      await postJson(`/api/admin/community/communities/${post.communityId}/members`, { action: "ban", userId: post.author.id, reason });
      toast(`${post.author.name} is banned from this community.`);
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

  const items: MenuItem[] = [];
  if (post.canEdit) items.push({ label: t.action.edit, onSelect: () => { setValue(toEditable(post.body)); setEditing(true); setError(""); } });
  if (post.builderHref) items.push({ label: t.menu.editBuilder, onSelect: () => router.push(post.builderHref) });
  items.push({ label: t.menu.copyLink, onSelect: () => void navigator.clipboard.writeText(`${location.origin}${href}`).then(() => toast(t.menu.linkCopied)).catch(() => toast(location.origin + href)) });
  if (post.canCategory && categories.length) items.push({ label: t.menu.changeCategory, onSelect: () => setCatOpen(true) });
  if (post.canPin) items.push({ label: post.pinned ? t.menu.unpin : t.menu.pin, onSelect: () => void meta({ pinned: !post.pinned }, post.pinned ? "Unpinned." : "Pinned to the feed.", true) });
  if (post.canLock) items.push({ label: post.commentsLocked ? t.menu.unlock : t.menu.lock, onSelect: async () => { if (await meta({ commentsLocked: !post.commentsLocked }, post.commentsLocked ? "Comments are on." : "Comments are off.")) setPost((p) => ({ ...p, commentsLocked: !p.commentsLocked })); } });
  if (post.canModerate && post.status === "published") items.push({ label: t.action.hide, onSelect: () => void moderate("hidden_by_mod") });
  if (post.canModerate && post.status === "hidden_by_mod") items.push({ label: t.action.unhide, onSelect: () => void moderate("published") });
  if (!post.mine) items.push({ label: t.action.report, onSelect: () => setReport(true) });
  if (post.canBan) items.push({ label: t.menu.ban, danger: true, onSelect: () => void ban() });
  if (post.canDelete) items.push({ label: t.action.delete, danger: true, onSelect: () => void remove() });

  const hiddenTag = post.status === "hidden_by_mod";
  const dialogs = (
    <>
      <ReportDialog target={report ? { type: "post", id: post.id } : null} onClose={() => setReport(false)} />
      <Dialog open={catOpen} title={t.menu.changeCategory} onClose={() => setCatOpen(false)}>
        <form className="cm-form" onSubmit={async (e) => { e.preventDefault(); if (await meta({ categoryId: cat ? Number(cat) : null }, "Category changed.")) { setPost((p) => ({ ...p, categoryId: cat ? Number(cat) : null })); setCatOpen(false); } }}>
          <label className="cm-field">
            <span>Category</span>
            <select className="cm-select" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "draft" ? " (draft)" : ""}</option>)}
            </select>
          </label>
          <div className="cm-actions"><button type="button" className="bb-btn bb-btn-outline" onClick={() => setCatOpen(false)}>{t.action.cancel}</button><button type="submit" className="bb-btn bb-btn-primary">{t.action.save}</button></div>
        </form>
      </Dialog>
    </>
  );

  // ---- rich post, in the feed: a snippet in one of the themes ----
  if (rich && !detail) {
    return (
      <>
        <RichSnippet
          id={`post-${post.id}`}
          href={href}
          data={{ title: post.title, excerpt: post.body, theme: post.theme, cover: post.cover, coverVideo: post.coverVideo, highlights: post.highlights, pinned: post.pinned, categoryName: category?.name, commentCount: post.commentCount, commentsLocked: post.commentsLocked, hidden: hiddenTag }}
          menu={<Menu items={items} />}
          like={<LikeButton type="post" id={post.id} liked={post.liked} count={post.likeCount} />}
          time={<span className="cm-rich__time"><RelativeTime iso={post.createdAt} /></span>}
        />
        {dialogs}
      </>
    );
  }

  return (
    <article className={`cm-card cm-post${hiddenTag ? " is-hidden" : ""}${post.pinned ? " is-pinned" : ""}`} id={`post-${post.id}`}>
      {post.pinned ? <p className="cm-pinned"><HighlightIcon name="pin" size={14} /> {t.rich.pinned}</p> : null}
      <div className="cm-post__head">
        <AuthorLine person={post.author} time={post.createdAt} edited={!!post.editedAt} hidden={hiddenTag} meId={meId} />
        <Menu items={items} />
      </div>
      {rich ? <h1 className="cm-post__title">{post.title}</h1> : null}
      {editing ? (
        <div className="cm-edit">
          <MentionTextarea value={value} onChange={setValue} communityId={communityId} label="Edit post" maxLength={LIMITS.postBody} rows={4} autoFocus />
          {error ? <p className="cm-error" role="alert">{error}</p> : null}
          <div className="cm-actions">
            <button type="button" className="bb-btn bb-btn-outline cm-btn-sm" onClick={() => setEditing(false)}>{t.action.cancel}</button>
            <button type="button" className="bb-btn bb-btn-primary cm-btn-sm" onClick={save} disabled={busy}>{busy ? t.action.saving : t.action.save}</button>
          </div>
        </div>
      ) : post.body && !rich ? (
        <MentionText body={post.body} people={localPeople} />
      ) : null}
      {category && detail ? <p className="cm-muted">{category.name}</p> : null}
      <ImageGrid media={post.media} />
      {rich ? <div className="cm-rich-body">{children}</div> : null}
      <div className="cm-post__foot">
        <LikeButton type="post" id={post.id} liked={post.liked} count={post.likeCount} />
        {detail ? (
          <span className="cm-muted">{t.post.comments(post.commentCount)}{post.commentsLocked ? " · comments are off" : ""}</span>
        ) : (
          <Link href={href} className="cm-link-btn">
            {t.post.comments(post.commentCount)}
          </Link>
        )}
        {category && !detail ? <span className="cm-chip">{category.name}</span> : null}
      </div>
      {dialogs}
    </article>
  );
}
