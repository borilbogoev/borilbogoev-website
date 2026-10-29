"use client";

// The rich post builder (Community). Derived from the landing page builder: same blocks, same three panes, same controls.
// It differs in what it saves: a post (title, excerpt, community, category, blocks) through /api/admin/community/rich.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ControlField, ImageControl, type ControlCtx, type ImageValue } from "@/modules/forms/admin/controls";
import { RichSnippet } from "../components/rich-snippet";
import { highlightsOf, snippetCover, THEMES, THEME_LABELS, type Theme } from "../lib/rich";
import { api, ApiError, Icon, useConfirm, useToast } from "@/modules/forms/admin/ui";
import type { Settings } from "@/modules/forms/lib/blocks";
import { brandIssues, type BrandIssue } from "@/modules/landing/lib/brand";
import { isLandingBlockType, landingDefaults, LANDING_BLOCKS, LANDING_GROUPS, type LandingBlock, type LandingBlockType } from "@/modules/landing/lib/blocks";
import { sanitizeLandingSettings } from "@/modules/landing/lib/settings";
import "@/modules/forms/admin/admin.css";
import "@/modules/landing/admin/landing-admin.css";
import "./admin.css";
import "../components/community.css";

type EditBlock = LandingBlock & { uid: number };

type Props = {
  postId: number;
  initial: { title: string; excerpt: string; status: string; theme: Theme; featured: { image?: ImageValue; video?: string }; communityId: number; categoryId: number | null; blocks: { type: string; settings: Settings }[] };
  communities: { id: number; name: string; slug: string }[];
  categories: { id: number; communityId: number; name: string; status: string }[];
  forms: { id: number; title: string }[];
  siteUrl: string;
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
// Blocks loaded with the page get 1..n, so the server HTML and the browser agree (no hydration mismatch). Later ones count up from 10000.
let uidCounter = 10000;
const nextUid = () => ++uidCounter;

/** Keys shown under "Layout" in the inspector, so the content controls stay short. */
const LAYOUT_KEYS = new Set(["bg", "spacing", "anchor", "hide"]);

export function RichPostBuilder({ postId, initial, communities, categories, forms, siteUrl }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const canSave = true;
  const settings = useMemo(() => sanitizeLandingSettings({}), []);
  const prep = (b: { type: string; settings: Settings }): EditBlock => ({ id: 0, type: b.type as LandingBlockType, settings: b.settings, uid: nextUid() });
  const prepInitial = (b: { type: string; settings: Settings }, i: number): EditBlock => ({ id: 0, type: b.type as LandingBlockType, settings: b.settings, uid: i + 1 });

  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [fImage, setFImage] = useState<ImageValue>({ id: 0, url: "", ...(initial.featured.image ?? {}) } as ImageValue);
  const [fVideo, setFVideo] = useState(initial.featured.video ?? "");
  const [communityId, setCommunityId] = useState(initial.communityId);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [status, setStatus] = useState(initial.status);
  const [blocks, setBlocks] = useState<EditBlock[]>(() => initial.blocks.map(prepInitial));
  const [sel, setSel] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const dragUid = useRef<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const community = communities.find((c) => c.id === communityId);
  const cats = categories.filter((c) => c.communityId === communityId);
  const slug = community?.slug ?? "community";
  const preview = useMemo(() => snippetCover(blocks.map((b) => ({ type: b.type, settings: b.settings })), { image: fImage.url ? fImage : undefined, video: fVideo }), [blocks, fImage, fVideo]);

  const touch = () => setDirty(true);
  const selected = blocks.find((b) => b.uid === sel) ?? null;
  const ctx: ControlCtx = useMemo(() => ({ uploadUrl: "/api/admin/landing/media", forms }), [forms]);
  const issues: BrandIssue[] = useMemo(() => brandIssues(blocks.map(({ uid, type, settings: s }) => ({ id: uid, type, settings: s })), settings), [blocks, settings]);
  const warns = issues.filter((i) => i.level === "warn").length;

  /* ---------- block operations ---------- */

  const add = (type: LandingBlockType, at?: number) => {
    const b: EditBlock = { id: 0, type, settings: landingDefaults(type), uid: nextUid() };
    setBlocks((cur) => {
      const i = at ?? (sel !== null ? cur.findIndex((x) => x.uid === sel) + 1 : cur.length);
      const next = [...cur];
      next.splice(i < 0 ? cur.length : i, 0, b);
      return next;
    });
    setSel(b.uid);
    touch();
    requestAnimationFrame(() => canvas.current?.querySelector(`[data-uid="${b.uid}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const move = (i: number, d: -1 | 1) => {
    setBlocks((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  };

  const duplicate = (i: number) => {
    setBlocks((cur) => {
      const copy: EditBlock = { ...clone(cur[i]), id: 0, uid: nextUid() };
      const next = [...cur];
      next.splice(i + 1, 0, copy);
      setSel(copy.uid);
      return next;
    });
    touch();
  };

  const remove = async (i: number) => {
    const b = blocks[i];
    if (b.id && !(await confirm(`Delete this ${LANDING_BLOCKS[b.type].label} block?`, "Delete block"))) return;
    setBlocks((cur) => cur.filter((x) => x.uid !== b.uid));
    if (sel === b.uid) setSel(null);
    touch();
  };

  const patchBlock = (u: number, key: string, value: unknown) => {
    setBlocks((cur) => cur.map((b) => (b.uid === u ? { ...b, settings: { ...b.settings, [key]: value } } : b)));
    touch();
  };

  /* ---------- drag and drop ---------- */

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    const cards = Array.from(canvas.current?.querySelectorAll<HTMLElement>(".bbfa-block") ?? []);
    let at = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        at = i;
        break;
      }
    }
    setDropAt(at);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const at = dropAt ?? blocks.length;
    setDropAt(null);
    const nt = e.dataTransfer.getData("text/bbf-new");
    if (nt && isLandingBlockType(nt)) return add(nt, at);
    const from = blocks.findIndex((b) => b.uid === dragUid.current);
    if (from < 0) return;
    setBlocks((cur) => {
      const next = [...cur];
      const [b] = next.splice(from, 1);
      next.splice(at > from ? at - 1 : at, 0, b);
      return next;
    });
    touch();
  };

  /* ---------- save ---------- */

  const save = useCallback(
    async (nextStatus?: string) => {
      if (saving) return;
      setSaving(true);
      const selIndex = blocks.findIndex((b) => b.uid === sel);
      try {
        const res = await api<{ post: { status: string; blocks: { type: string; settings: Settings }[] } }>(`community/rich/${postId}`, {
          method: "PUT",
          body: { title, excerpt, theme, featured: { image: fImage.url ? fImage : undefined, video: fVideo }, communityId, categoryId, status: nextStatus ?? status, blocks: blocks.map((b) => ({ type: b.type, settings: b.settings })) },
        });
        const next = res.post.blocks.map(prep);
        setBlocks(next);
        setSel(selIndex > -1 && next[selIndex] ? next[selIndex].uid : null);
        setStatus(res.post.status);
        setDirty(false);
        toast(nextStatus === "published" ? "Published" : nextStatus === "draft" ? "Moved to drafts" : "Saved");
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Save failed", "error");
      } finally {
        setSaving(false);
      }
    },
    [saving, blocks, sel, postId, title, excerpt, theme, fImage, fVideo, communityId, categoryId, status, toast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [save, dirty]);

  const live = status === "published";
  const isHidden = status === "hidden_by_mod";

  return (
    <div className="bbfa-builder">
      {/* Palette */}
      <aside className="bbfa-palette">
        <div className="bbfa-palette__head">
          <div className="bbfa-eyebrow">Blocks</div>
          <p>Click to add below the selected block, or drag into the page.</p>
        </div>
        {(Object.keys(LANDING_GROUPS) as (keyof typeof LANDING_GROUPS)[]).map((g) => (
          <div key={g}>
            <div className="bbfa-palette__group">{LANDING_GROUPS[g]}</div>
            <div className="bbfa-palette__grid">
              {(Object.keys(LANDING_BLOCKS) as LandingBlockType[])
                .filter((t) => LANDING_BLOCKS[t].group === g)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="bbfa-palette__item"
                    disabled={!canSave}
                    title={LANDING_BLOCKS[t].desc}
                    draggable={canSave}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/bbf-new", t);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => add(t)}
                  >
                    <span className="bbfa-palette__icon">
                      <Icon name={LANDING_BLOCKS[t].icon} />
                    </span>
                    <span>{LANDING_BLOCKS[t].label}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </aside>

      {/* Canvas */}
      <main className="bbfa-canvas" ref={canvas}>
        <div className="bbfa-canvas__head">
          <div className="bbfa-canvas__title">
            <input
              className="bbfa-title-input"
              value={title}
              aria-label="Post title"
              placeholder="Post title"
              maxLength={140}
              onChange={(e) => {
                setTitle(e.target.value);
                touch();
              }}
            />
            <span className={`bbfa-pill bbfa-pill--${live ? "active" : "draft"}`}>{live ? "Published" : isHidden ? "Hidden" : "Draft"}</span>
            <button type="button" className={`bbfa-btn${live ? " bbfa-btn--ghost" : ""}${saving ? " is-loading" : ""}${dirty ? " is-dirty" : ""}`} onClick={() => void save()}>
              <span>Save</span>
            </button>
            {!live ? (
              <button type="button" className={`bbfa-btn${saving ? " is-loading" : ""}`} onClick={() => void save("published")}>
                <span>Publish</span>
              </button>
            ) : (
              <button type="button" className="bbfa-btn bbfa-btn--ghost" onClick={() => void save("draft")}>
                <span>Unpublish</span>
              </button>
            )}
          </div>
          <div className="cm-adm-form cm-rich-meta">
            <div className="row2">
              <label>
                <span className="cm-adm-label">Community</span>
                <select value={communityId} onChange={(e) => { setCommunityId(Number(e.target.value)); setCategoryId(null); touch(); }}>
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span className="cm-adm-label">Category</span>
                <select value={categoryId ?? ""} onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : null); touch(); }}>
                  <option value="">No category</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "draft" ? " (draft)" : ""}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span className="cm-adm-label">Feed excerpt (shown under the title in the feed, up to 400 characters)</span>
              <textarea rows={2} maxLength={400} value={excerpt} onChange={(e) => { setExcerpt(e.target.value); touch(); }} />
            </label>
            <fieldset className="cm-themes">
              <legend className="cm-adm-label">Feed look</legend>
              <div className="cm-themes__grid">
                {THEMES.map((th) => (
                  <label key={th} className={`cm-theme${theme === th ? " is-on" : ""}`}>
                    <input type="radio" name="theme" value={th} checked={theme === th} onChange={() => { setTheme(th); touch(); }} />
                    <span className={`cm-theme__sw cm-theme__sw--${th}`} aria-hidden="true"><i /><i /></span>
                    <strong>{THEME_LABELS[th].name}</strong>
                    <small>{THEME_LABELS[th].desc}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="row2">
              <div>
                <ImageControl label="Featured picture (optional)" value={fImage} uploadUrl="/api/admin/landing/media" onChange={(v) => { setFImage(v); touch(); }} />
              </div>
              <label>
                <span className="cm-adm-label">Featured video link (optional)</span>
                <input type="text" placeholder="https://www.youtube.com/watch?v=..." value={fVideo} onChange={(e) => { setFVideo(e.target.value); touch(); }} />
                <small className="bbfa-muted">YouTube, Vimeo, Loom or an MP4. With a picture it shows a play mark on it; a YouTube link alone gets its own thumbnail.</small>
              </label>
            </div>
            <p className="bbfa-muted" style={{ margin: 0 }}>If you set neither, the snippet uses the first picture or video in the blocks below.</p>
            <div>
              <span className="cm-adm-label">Preview in the feed</span>
              <div className="cm-preview">
                <RichSnippet
                  href={`/community/${slug}/post/${postId}`}
                  data={{ title: title || "Untitled post", excerpt, theme, cover: preview.url, coverVideo: preview.video, highlights: highlightsOf(blocks.map((b) => ({ type: b.type, settings: b.settings }))), pinned: false, categoryName: cats.find((c) => c.id === categoryId)?.name, commentCount: 0, commentsLocked: false }}
                />
              </div>
            </div>
          </div>
          <div className="bbfa-canvas__meta">
            {blocks.length} blocks · {siteUrl.replace(/^https?:\/\//, "")}/community/{slug}/post/{postId}
            {" "}
            · <a href={`/community/${slug}/post/${postId}`} target="_blank" rel="noopener noreferrer">{live ? "View live ↗" : "Preview ↗"}</a>
            {" "}
            · <Link href="/admin/communities/posts">All rich posts</Link>
          </div>
          {issues.length ? (
            <button type="button" className={`bbfa-brandcheck${warns ? " has-warn" : ""}`} aria-expanded={showIssues} onClick={() => setShowIssues((v) => !v)}>
              <Icon name="shield" />
              Brand check: {warns ? `${warns} to fix` : "all clear"}
              {issues.length - warns ? `, ${issues.length - warns} suggestion${issues.length - warns > 1 ? "s" : ""}` : ""}
            </button>
          ) : (
            <span className="bbfa-brandcheck">
              <Icon name="shield" />
              Brand check: all clear
            </span>
          )}
          {showIssues ? (
            <ul className="bbfa-issues">
              {issues.map((i, k) => (
                <li key={k} className={i.level === "warn" ? "is-warn" : ""}>
                  <button
                    type="button"
                    disabled={!i.blockId}
                    onClick={() => {
                      const b = blocks.find((x) => x.uid === i.blockId);
                      if (b) {
                        setSel(b.uid);
                        canvas.current?.querySelector(`[data-uid="${b.uid}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }}
                  >
                    {i.message}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="bbfa-blocks" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={() => setDropAt(null)}>
          {!blocks.length ? (
            <div className="bbfa-empty is-canvas">
              <div className="bbfa-empty__icon">
                B<i>*</i>
              </div>
              <h3>Your post is empty</h3>
              <p>Add blocks from the left: a Hero, text, an image, a form, a countdown. Members see them in this order.</p>
            </div>
          ) : null}
          {blocks.map((b, i) => {
            const T = LANDING_BLOCKS[b.type];
            const d = describe(b);
            return (
              <div
                key={b.uid}
                data-uid={b.uid}
                tabIndex={0}
                draggable={canSave}
                className={`bbfa-block is-lp${sel === b.uid ? " is-selected" : ""}${dropAt === i ? " drop-before" : ""}${dropAt === blocks.length && i === blocks.length - 1 ? " drop-after" : ""}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".bbfa-block__tools")) return;
                  setSel(b.uid);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setSel(b.uid)}
                onDragStart={(e) => {
                  dragUid.current = b.uid;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", "bbf");
                }}
                onDragEnd={() => {
                  dragUid.current = null;
                  setDropAt(null);
                }}
              >
                <div className="bbfa-block__head">
                  <span className="bbfa-grip">
                    <Icon name="grip" />
                  </span>
                  <span className="bbfa-block__type">
                    <Icon name={T.icon} />
                    <span>{T.label}</span>
                  </span>
                  <span className="bbfa-block__chips">
                    {d.chips.map((c) => (
                      <span className="bbfa-chip" key={c}>
                        {c}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="bbfa-card-body bbfa-lp-body">
                  {d.thumb ? <img className="bbfa-lp-thumb" src={d.thumb} alt="" /> : null}
                  <div>
                    {d.title ? <div className="bbfa-prev-q">{d.title}</div> : <div className="bbfa-prev-desc">Empty block</div>}
                    {d.sub ? <div className="bbfa-prev-desc">{d.sub}</div> : null}
                  </div>
                </div>
                {canSave ? (
                  <div className="bbfa-block__tools">
                    <button type="button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <Icon name="up" />
                    </button>
                    <button type="button" title="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                      <Icon name="down" />
                    </button>
                    <button type="button" title="Duplicate" onClick={() => duplicate(i)}>
                      <Icon name="copy" />
                    </button>
                    <button type="button" title="Delete" className="is-danger" onClick={() => remove(i)}>
                      <Icon name="trash" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </main>

      {/* Inspector */}
      <aside className="bbfa-inspector">
        {selected ? (
          <Inspector key={selected.uid} block={selected} readOnly={!canSave} ctx={ctx} onSet={(k, v) => patchBlock(selected.uid, k, v)} />
        ) : (
          <div className="bbfa-inspector__empty">
            <div className="bbfa-empty__icon">
              <Icon name="edit" />
            </div>
            <h4>Select a block</h4>
            <p>Click any block on the page to edit its content and settings.</p>
            <div className="bbfa-shortcuts">
              <div>
                <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd> Save
              </div>
              <div>Drag blocks to reorder</div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Inspector({ block, readOnly, ctx, onSet }: { block: EditBlock; readOnly: boolean; ctx: ControlCtx; onSet: (key: string, value: unknown) => void }) {
  const T = LANDING_BLOCKS[block.type];
  const content = T.controls.filter((c) => !LAYOUT_KEYS.has(c.key));
  const layout = T.controls.filter((c) => LAYOUT_KEYS.has(c.key));
  return (
    <>
      <div className="bbfa-inspector__head">
        <span className="bbfa-palette__icon">
          <Icon name={T.icon} />
        </span>
        <div>
          <div className="bbfa-eyebrow">Block settings</div>
          <h3>{T.label}</h3>
        </div>
      </div>
      <p className="bbfa-inspector__desc">{T.desc}</p>
      <fieldset className="bbfa-inspector__body" disabled={readOnly} style={{ border: 0, margin: 0, minWidth: 0 }}>
        {content.map((c) => (
          <ControlField key={c.key} control={c} settings={block.settings} set={onSet} ctx={ctx} />
        ))}
        {layout.length ? (
          <details className="bbfa-layout">
            <summary>Layout and anchor</summary>
            {layout.map((c) => (
              <ControlField key={c.key} control={c} settings={block.settings} set={onSet} ctx={ctx} />
            ))}
          </details>
        ) : null}
      </fieldset>
    </>
  );
}

/* -------------------------------------------------------------------------- */

const TITLE_KEYS = ["headline", "heading", "title", "name", "quote", "label", "badge", "cta_label", "text", "content", "eyebrow", "left_title"];
const SUB_KEYS = ["subtitle", "intro", "text", "description", "role", "eyebrow", "cta_label", "content", "url"];

function strip(v: unknown, max = 130): string {
  const t = String(v ?? "").replace(/[#*_`>]|\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function firstImage(s: Settings): string {
  for (const k of ["image", "poster", "artwork"]) if (s[k]?.url) return s[k].variants?.[0]?.url ?? s[k].url;
  for (const it of Array.isArray(s.items) ? s.items : []) if (it?.image?.url) return it.image.variants?.[0]?.url ?? it.image.url;
  return "";
}

/** What a block card shows on the canvas: its main text, a second line, a thumbnail and a few facts. */
function describe(b: LandingBlock) {
  const s = b.settings;
  let title = "";
  for (const k of TITLE_KEYS) if (typeof s[k] === "string" && s[k].trim()) { title = strip(s[k], 90); break; }
  if (!title && Array.isArray(s.items) && s.items.length) {
    const it = s.items[0];
    title = strip(typeof it === "string" ? it : (it.title ?? it.q ?? it.name ?? it.label ?? it.quote ?? ""), 90);
  }
  let sub = "";
  for (const k of SUB_KEYS) if (typeof s[k] === "string" && s[k].trim() && strip(s[k], 90) !== title) { sub = strip(s[k]); break; }
  const chips: string[] = [];
  if (Array.isArray(s.items) && s.items.length) chips.push(`${s.items.length} ${s.items.length === 1 ? "item" : "items"}`);
  if (b.type === "form") chips.push(Number(s.form_id) > 0 ? `form #${s.form_id}` : "no form chosen");
  if (b.type === "cta") chips.push(String(s.length));
  if (s.bg === "inverse" || s.style === "inverse") chips.push("dark band");
  else if (s.bg === "alt") chips.push("grey band");
  if (s.hide) chips.push(s.hide === "mobile" ? "phones only" : "desktop only");
  if (s.anchor) chips.push(`#${s.anchor}`);
  return { title, sub, thumb: firstImage(s), chips };
}
