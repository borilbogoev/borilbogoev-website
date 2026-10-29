"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ApiError, del, message, newRequestId, post as postJson, request, type Category, type Media, type People, type Post } from "../lib/client";
import { IMAGE_TYPES, LIMITS } from "../lib/constants";
import { t } from "../strings";
import { emptyMention, MentionTextarea, stored, type MentionValue } from "./mention-textarea";

type Draft = { id: number; url: string; alt: string };

/** Text, up to a few images, and one Post button. Images upload as soon as they are chosen; the server owns type, size and the storage key. */
export function PostComposer({
  communityId,
  slug,
  categories = [],
  defaultCategoryId = null,
  richHref = "",
  maxImages,
  maxImageMb,
  onCreated,
}: {
  communityId: number;
  slug: string;
  categories?: Category[];
  defaultCategoryId?: number | null;
  richHref?: string;
  maxImages: number;
  maxImageMb: number;
  onCreated: (post: Post, people: People) => void;
}) {
  const [value, setValue] = useState<MentionValue>(emptyMention());
  const [images, setImages] = useState<Draft[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState(String(defaultCategoryId ?? ""));
  const requestId = useRef(newRequestId());
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files);
    if (images.length + uploading + list.length > maxImages) {
      setError(t.errors.imageCount(maxImages));
      return;
    }
    for (const f of list) {
      if (!(IMAGE_TYPES as readonly string[]).includes(f.type)) return setError(t.errors.imageType);
      if (f.size > maxImageMb * 1024 * 1024) return setError(t.errors.imageSize(maxImageMb));
    }
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("communityId", String(communityId));
        const { media } = await request<{ media: Media }>("POST", "/api/community/uploads/image", fd);
        setImages((cur) => [...cur, { id: media.id, url: media.url, alt: "" }]);
      } catch (e) {
        setError(message(e));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function remove(id: number) {
    setImages((cur) => cur.filter((i) => i.id !== id));
    void del(`/api/community/uploads/image?id=${id}`).catch(() => {});
  }

  const body = stored(value);
  const canSubmit = !busy && !uploading && (value.text.trim().length > 0 || images.length > 0);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const res = await postJson<{ item: Post; people: People }>(`/api/community/${slug}/posts`, { body, mediaIds: images.map((i) => i.id), alts: Object.fromEntries(images.map((i) => [i.id, i.alt])), categoryId: category ? Number(category) : null, requestId: requestId.current });
      onCreated(res.item, res.people);
      setValue(emptyMention());
      setImages([]);
      requestId.current = newRequestId();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? err.message : message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cm-card cm-composer" onSubmit={submit} aria-label="New post">
      <MentionTextarea value={value} onChange={setValue} communityId={communityId} label="Write a post" placeholder={t.composer.placeholder} maxLength={LIMITS.postBody} rows={3} disabled={busy} onSubmitShortcut={() => void submit()} />
      {images.length || uploading ? (
        <ul className="cm-previews" aria-label="Images">
          {images.map((img, i) => (
            <li key={img.id}>
              <div className="cm-previews__img">
                <img src={img.url} alt={img.alt || `Image ${i + 1}`} />
                <button type="button" className="cm-previews__x" onClick={() => remove(img.id)} aria-label={`${t.action.removeImage} ${i + 1}`}>
                  ×
                </button>
              </div>
              <label className="cm-sr" htmlFor={`alt-${img.id}`}>{`Description of image ${i + 1}`}</label>
              <input id={`alt-${img.id}`} className="cm-alt" type="text" maxLength={300} placeholder={t.composer.altPlaceholder} value={img.alt} onChange={(e) => setImages((cur) => cur.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)))} />
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li key={`u${i}`} className="cm-skeleton cm-previews__loading" aria-label="Uploading" />
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="cm-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="cm-composer__bar">
        <div className="cm-composer__tools">
          <input ref={fileInput} id={`img-${communityId}`} className="cm-sr" type="file" accept={IMAGE_TYPES.join(",")} multiple onChange={(e) => void addFiles(e.target.files)} />
          <label htmlFor={`img-${communityId}`} className={`bb-btn bb-btn-outline cm-btn-sm${images.length + uploading >= maxImages ? " is-disabled" : ""}`} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileInput.current?.click())}>
            {t.action.addImages}
          </label>
          <span className="cm-muted cm-count" aria-live="off">
            {t.composer.count(value.text.length, LIMITS.postBody)}
          </span>
        </div>
        <div className="cm-composer__tools">
          {categories.length ? (
            <label className="cm-sr" htmlFor={`cat-${communityId}`}>Category</label>
          ) : null}
          {categories.length ? (
            <select id={`cat-${communityId}`} className="cm-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : null}
          {richHref ? <Link href={richHref} className="bb-btn bb-btn-outline cm-btn-sm">{t.rich.build}</Link> : null}
          <button type="submit" className="bb-btn bb-btn-primary" disabled={!canSubmit}>
            {busy ? t.action.posting : t.action.post}
          </button>
        </div>
      </div>
    </form>
  );
}
