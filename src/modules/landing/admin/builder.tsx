"use client";

// The landing page builder. Same three panes and the same controls as the Forms builder:
// pick a block on the left, it lands in the middle, configure it on the right.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ControlField, type ControlCtx } from "@/modules/forms/admin/controls";
import { api, ApiError, Icon, useConfirm, useToast } from "@/modules/forms/admin/ui";
import type { Settings } from "@/modules/forms/lib/blocks";
import { brandIssues, type BrandIssue } from "../lib/brand";
import { isLandingBlockType, landingDefaults, LANDING_BLOCKS, LANDING_GROUPS, type LandingBlock, type LandingBlockType } from "../lib/blocks";
import { PAGE_STATUSES, STATUS_LABELS, type LandingSettings } from "../lib/settings";
import "./landing-admin.css";

type EditBlock = LandingBlock & { uid: number };

type Props = {
  pageId: number;
  slug: string;
  siteUrl: string;
  initialTitle: string;
  initialStatus: string;
  initialBlocks: LandingBlock[];
  settings: LandingSettings;
  forms: { id: number; title: string }[];
  canSave: boolean;
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
// Blocks loaded with the page get 1..n, so the server HTML and the browser agree (no hydration mismatch). Later ones count up from 10000.
let uidCounter = 10000;
const nextUid = () => ++uidCounter;

/** Keys shown under "Layout" in the inspector, so the content controls stay short. */
const LAYOUT_KEYS = new Set(["bg", "spacing", "anchor", "hide"]);

export function LandingBuilder({ pageId, slug, siteUrl, initialTitle, initialStatus, initialBlocks, settings, forms, canSave }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const prep = (b: LandingBlock): EditBlock => ({ ...b, uid: nextUid() });
  const prepInitial = (b: LandingBlock, i: number): EditBlock => ({ ...b, uid: i + 1 });

  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [blocks, setBlocks] = useState<EditBlock[]>(() => initialBlocks.map(prepInitial));
  const [sel, setSel] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const dragUid = useRef<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const touch = () => setDirty(true);
  const selected = blocks.find((b) => b.uid === sel) ?? null;
  const ctx: ControlCtx = useMemo(() => ({ uploadUrl: "/api/admin/landing/media", forms }), [forms]);
  const issues: BrandIssue[] = useMemo(() => brandIssues(blocks.map(({ id, type, settings: s }) => ({ id, type, settings: s })), settings), [blocks, settings]);
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
      if (saving || !canSave) return;
      setSaving(true);
      const selIndex = blocks.findIndex((b) => b.uid === sel);
      try {
        const res = await api<{ blocks: LandingBlock[]; page: { status: string } }>(`landing/${pageId}`, {
          method: "PUT",
          body: { title, status: nextStatus ?? status, blocks: blocks.map((b) => ({ id: b.id, type: b.type, settings: b.settings })) },
        });
        const next = res.blocks.map(prep);
        setBlocks(next);
        setSel(selIndex > -1 && next[selIndex] ? next[selIndex].uid : null);
        setStatus(res.page.status);
        setDirty(false);
        toast(nextStatus === "published" ? "Published" : nextStatus === "draft" ? "Unpublished" : "Page saved");
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Save failed", "error");
      } finally {
        setSaving(false);
      }
    },
    [saving, canSave, blocks, sel, pageId, title, status, toast],
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
              aria-label="Page name"
              disabled={!canSave}
              onChange={(e) => {
                setTitle(e.target.value);
                touch();
              }}
            />
            <select
              className="bbfa-status-select"
              value={status}
              disabled={!canSave}
              aria-label="Status"
              onChange={(e) => {
                setStatus(e.target.value);
                touch();
              }}
            >
              {PAGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {canSave ? (
              <>
                <button type="button" className={`bbfa-btn${live ? " bbfa-btn--ghost" : ""}${saving ? " is-loading" : ""}${dirty ? " is-dirty" : ""}`} onClick={() => void save()}>
                  <span>Save</span>
                </button>
                {!live ? (
                  <button type="button" className={`bbfa-btn${saving ? " is-loading" : ""}`} onClick={() => void save("published")}>
                    <span>Publish</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="bbfa-canvas__meta">
            {blocks.length} blocks · {siteUrl.replace(/^https?:\/\//, "")}/l/{slug}
            {live ? (
              <>
                {" "}
                · <a href={`/l/${slug}`} target="_blank" rel="noopener noreferrer">View live ↗</a>
              </>
            ) : null}
            {" "}
            · <a href={`/admin/landing/${pageId}/preview`} target="_blank" rel="noopener noreferrer">Preview ↗</a>
            {canSave ? null : " · view only"}
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
                      const b = blocks.find((x) => x.id === i.blockId);
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
              <h3>Your page is empty</h3>
              <p>Start with a Hero block, then add what the visitor needs to decide: proof, offer, form.</p>
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
