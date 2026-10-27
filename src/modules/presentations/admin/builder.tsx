"use client";

// The presentation builder. Same three panes as the Forms and Landing builders:
// pick a slide layout or an element on the left, build in the middle (every slide drawn with the real deck styles),
// configure the selected slide or element on the right.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { ControlField, type ControlCtx } from "@/modules/forms/admin/controls";
import { api, ApiError, Icon, useConfirm, useToast } from "@/modules/forms/admin/ui";
import "@/modules/landing/admin/landing-admin.css";
import { SlideThumb } from "../components/deck";
import { brandIssues, type BrandIssue } from "../lib/brand";
import { ELEMENT_GROUPS, ELEMENTS, PLACEMENT_KEYS, elementDefaults, isElementType, type DeckElement, type ElementType, type Settings } from "../lib/elements";
import { DECK_STATUSES, MODE_LABELS, STATUS_LABELS, type DeckMode, type DeckOrientation } from "../lib/settings";
import { SLIDE_ACCORDION_KEYS, SLIDE_CONTROLS, SLIDE_GROUPS, SLIDE_KINDS, SLIDE_KIND_KEYS, SLIDE_LOOK_KEYS, isSlideKind, newSlide, slideTitle, type DeckSlide, type SlideKind } from "../lib/slides";
import { PIcon } from "./picon";
import "./presentations-admin.css";

type EditEl = DeckElement & { uid: number };
type EditSlide = Omit<DeckSlide, "elements"> & { uid: number; elements: EditEl[] };
type Sel = { s: number; e: number | null } | null;

type Props = {
  deckId: number;
  slug: string;
  siteUrl: string;
  initialTitle: string;
  initialStatus: string;
  initialMode: DeckMode;
  initialOrientation: DeckOrientation;
  dark: boolean;
  large?: boolean;
  protectedDeck: boolean;
  initialSlides: DeckSlide[];
  forms: { id: number; title: string }[];
  canSave: boolean;
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
// Items loaded with the page get small numbers in a fixed order, so the server HTML and the browser agree. Later ones count up from 100000.
let uidCounter = 100000;
const nextUid = () => ++uidCounter;

const prepInitial = (slides: DeckSlide[]): EditSlide[] => {
  let e = 1000;
  return slides.map((s, i) => ({ ...s, uid: i + 1, elements: s.elements.map((x) => ({ ...x, uid: ++e })) }));
};
const prepNew = (s: { kind: SlideKind; settings: Settings; elements: { type: ElementType; settings: Settings }[] }): EditSlide => ({ id: 0, uid: nextUid(), kind: s.kind, settings: s.settings, elements: s.elements.map((x) => ({ id: 0, uid: nextUid(), type: x.type, settings: x.settings })) });

const strip = (v: unknown, max = 70): string => {
  const t = String(v ?? "").replace(/[#*_`>]|\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

function elementLabel(e: DeckElement): string {
  const s = e.settings;
  const first = s.text || s.content || s.quote || s.label || s.name || s.title || s.code || (Array.isArray(s.items) && s.items.length ? (typeof s.items[0] === "string" ? s.items[0] : s.items[0]?.title || s.items[0]?.label || s.items[0]?.caption) : "") || s.url || "";
  return strip(first, 44);
}

/* -------------------------------------------------------------------------- */

export function PresentationBuilder({ deckId, slug, siteUrl, initialTitle, initialStatus, initialMode, initialOrientation, dark, large, protectedDeck, initialSlides, forms, canSave }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [mode, setMode] = useState<DeckMode>(initialMode);
  const [orientation, setOrientation] = useState<DeckOrientation>(initialOrientation);
  const [slides, setSlides] = useState<EditSlide[]>(() => prepInitial(initialSlides));
  const [sel, setSel] = useState<Sel>(null);
  const [tab, setTab] = useState<"slides" | "elements">("slides");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dropEl, setDropEl] = useState<number | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const dragUid = useRef<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const touch = useCallback(() => setDirty(true), []);
  const selSlide = sel ? slides.find((s) => s.uid === sel.s) ?? null : null;
  const selEl = selSlide && sel?.e ? selSlide.elements.find((e) => e.uid === sel.e) ?? null : null;
  const ctx: ControlCtx = useMemo(() => ({ uploadUrl: "/api/admin/presentations/media", forms }), [forms]);
  const issues: BrandIssue[] = useMemo(() => brandIssues(slides as unknown as DeckSlide[]), [slides]);
  const warns = issues.filter((i) => i.level === "warn").length;
  const live = status === "active";

  const scrollTo = (uid: number) => requestAnimationFrame(() => document.querySelector(`.bbp-slide[data-uid="${uid}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));

  /* ---------- slide operations ---------- */

  const addSlide = (kind: SlideKind, at?: number) => {
    const s = prepNew(newSlide(kind));
    setSlides((cur) => {
      const here = sel ? cur.findIndex((x) => x.uid === sel.s) + 1 : cur.length;
      const i = at ?? (here <= 0 ? cur.length : here);
      const next = [...cur];
      next.splice(i, 0, s);
      return next;
    });
    setSel({ s: s.uid, e: null });
    touch();
    scrollTo(s.uid);
  };

  const moveSlide = useCallback(
    (i: number, d: -1 | 1) => {
      setSlides((cur) => {
        const j = i + d;
        if (j < 0 || j >= cur.length) return cur;
        const next = [...cur];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
      touch();
    },
    [touch],
  );

  const duplicateSlide = useCallback(
    (i: number) => {
      const copyUid = nextUid();
      setSlides((cur) => {
        const src = cur[i];
        const copy: EditSlide = { ...clone(src), id: 0, uid: copyUid, elements: src.elements.map((e) => ({ ...clone(e), id: 0, uid: nextUid() })) };
        const next = [...cur];
        next.splice(i + 1, 0, copy);
        return next;
      });
      setSel({ s: copyUid, e: null });
      touch();
    },
    [touch],
  );

  const removeSlide = useCallback(
    async (uid: number) => {
      if (!(await confirm("Delete this slide and everything on it?", "Delete slide"))) return;
      setSlides((cur) => cur.filter((x) => x.uid !== uid));
      setSel((s) => (s?.s === uid ? null : s));
      touch();
    },
    [confirm, touch],
  );

  const hideSlide = useCallback(
    (uid: number, hidden: boolean) => {
      setSlides((cur) => cur.map((s) => (s.uid === uid ? { ...s, settings: { ...s.settings, hidden: hidden ? 1 : 0 } } : s)));
      touch();
    },
    [touch],
  );

  const startDrag = useCallback((uid: number) => {
    dragUid.current = uid;
  }, []);
  const endDrag = useCallback(() => {
    dragUid.current = null;
    setDropAt(null);
  }, []);

  const patchSlide = (uid: number, key: string, value: unknown) => {
    setSlides((cur) => cur.map((s) => (s.uid === uid ? { ...s, settings: { ...s.settings, [key]: value } } : s)));
    touch();
  };

  /* ---------- element operations ---------- */

  const addElement = (slideUid: number, type: ElementType) => {
    const el: EditEl = { id: 0, uid: nextUid(), type, settings: elementDefaults(type) };
    setSlides((cur) =>
      cur.map((s) => {
        if (s.uid !== slideUid) return s;
        const after = sel?.s === slideUid && sel.e ? s.elements.findIndex((x) => x.uid === sel.e) + 1 : s.elements.length;
        const next = [...s.elements];
        next.splice(after <= 0 ? next.length : after, 0, el);
        return { ...s, elements: next };
      }),
    );
    setSel({ s: slideUid, e: el.uid });
    touch();
  };

  const moveElement = (slideUid: number, elUid: number, d: -1 | 1) => {
    setSlides((cur) =>
      cur.map((s) => {
        if (s.uid !== slideUid) return s;
        const i = s.elements.findIndex((x) => x.uid === elUid);
        const j = i + d;
        if (i < 0 || j < 0 || j >= s.elements.length) return s;
        const next = [...s.elements];
        [next[i], next[j]] = [next[j], next[i]];
        return { ...s, elements: next };
      }),
    );
    touch();
  };

  const duplicateElement = (slideUid: number, elUid: number) => {
    const copyUid = nextUid();
    setSlides((cur) =>
      cur.map((s) => {
        if (s.uid !== slideUid) return s;
        const i = s.elements.findIndex((x) => x.uid === elUid);
        if (i < 0) return s;
        const next = [...s.elements];
        next.splice(i + 1, 0, { ...clone(s.elements[i]), id: 0, uid: copyUid });
        return { ...s, elements: next };
      }),
    );
    setSel({ s: slideUid, e: copyUid });
    touch();
  };

  const removeElement = (slideUid: number, elUid: number) => {
    setSlides((cur) => cur.map((s) => (s.uid === slideUid ? { ...s, elements: s.elements.filter((x) => x.uid !== elUid) } : s)));
    setSel((s) => (s?.e === elUid ? { s: slideUid, e: null } : s));
    touch();
  };

  const patchElement = (slideUid: number, elUid: number, key: string, value: unknown) => {
    setSlides((cur) => cur.map((s) => (s.uid === slideUid ? { ...s, elements: s.elements.map((e) => (e.uid === elUid ? { ...e, settings: { ...e.settings, [key]: value } } : e)) } : s)));
    touch();
  };

  const select = useCallback((s: number, e: number | null) => setSel({ s, e }), []);

  /* ---------- drag and drop ---------- */

  const onDragOver = (e: DragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes("text/bbp-el")) {
      e.preventDefault();
      const card = (e.target as HTMLElement).closest<HTMLElement>(".bbp-slide");
      setDropEl(card ? Number(card.dataset.uid) : null);
      setDropAt(null);
      return;
    }
    e.preventDefault();
    setDropEl(null);
    const cards = Array.from(canvas.current?.querySelectorAll<HTMLElement>(".bbp-slide") ?? []);
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
    const at = dropAt ?? slides.length;
    const target = dropEl;
    setDropAt(null);
    setDropEl(null);
    const el = e.dataTransfer.getData("text/bbp-el");
    if (el && isElementType(el)) {
      const uid = target ?? sel?.s ?? slides[slides.length - 1]?.uid;
      if (uid) addElement(uid, el);
      return;
    }
    const sk = e.dataTransfer.getData("text/bbp-slide");
    if (sk && isSlideKind(sk)) return addSlide(sk, at);
    const from = slides.findIndex((s) => s.uid === dragUid.current);
    if (from < 0) return;
    setSlides((cur) => {
      const next = [...cur];
      const [s] = next.splice(from, 1);
      next.splice(at > from ? at - 1 : at, 0, s);
      return next;
    });
    touch();
  };

  /* ---------- save ---------- */

  const save = useCallback(
    async (nextStatus?: string) => {
      if (saving || !canSave) return;
      setSaving(true);
      const selS = sel ? slides.findIndex((s) => s.uid === sel.s) : -1;
      const selE = selS > -1 && sel?.e ? slides[selS].elements.findIndex((x) => x.uid === sel.e) : -1;
      try {
        const res = await api<{ slides: DeckSlide[]; deck: { status: string } }>(`presentations/${deckId}`, {
          method: "PUT",
          body: { title, status: nextStatus ?? status, mode, orientation, slides: slides.map((s) => ({ id: s.id, kind: s.kind, settings: s.settings, elements: s.elements.map((e) => ({ id: e.id, type: e.type, settings: e.settings })) })) },
        });
        const next = res.slides.map((s) => prepNew({ kind: s.kind, settings: s.settings, elements: s.elements })).map((s, i) => ({ ...s, id: res.slides[i].id, elements: s.elements.map((e, j) => ({ ...e, id: res.slides[i].elements[j].id })) }));
        setSlides(next);
        setSel(selS > -1 && next[selS] ? { s: next[selS].uid, e: selE > -1 ? (next[selS].elements[selE]?.uid ?? null) : null } : null);
        setStatus(res.deck.status);
        setDirty(false);
        toast(nextStatus === "active" ? "Activated" : nextStatus === "draft" ? "Moved to draft" : "Saved");
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Save failed", "error");
      } finally {
        setSaving(false);
      }
    },
    [saving, canSave, sel, slides, deckId, title, status, mode, orientation, toast],
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

  const portrait = orientation === "portrait";

  return (
    <div className="bbfa-builder">
      {/* Palette */}
      <aside className="bbfa-palette">
        <div className="bbfa-palette__head">
          <div className="bbfa-eyebrow">Add</div>
          <div className="bbp-ptabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "slides"} className={tab === "slides" ? "is-active" : ""} onClick={() => setTab("slides")}>
              Slides
            </button>
            <button type="button" role="tab" aria-selected={tab === "elements"} className={tab === "elements" ? "is-active" : ""} onClick={() => setTab("elements")}>
              Elements
            </button>
          </div>
          <p className="bbp-hint">{tab === "slides" ? "A slide layout starts with the right structure. Click to add it below the selected slide, or drag it in." : "Elements go inside the selected slide. Click to add, or drag onto a slide."}</p>
        </div>
        {tab === "slides"
          ? (Object.keys(SLIDE_GROUPS) as (keyof typeof SLIDE_GROUPS)[]).map((g) => (
              <div key={g}>
                <div className="bbfa-palette__group">{SLIDE_GROUPS[g]}</div>
                <div className="bbfa-palette__grid">
                  {SLIDE_KIND_KEYS.filter((k) => SLIDE_KINDS[k].group === g).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="bbfa-palette__item"
                      disabled={!canSave}
                      title={SLIDE_KINDS[k].desc}
                      draggable={canSave}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/bbp-slide", k);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addSlide(k)}
                    >
                      <span className="bbfa-palette__icon">
                        <PIcon name={SLIDE_KINDS[k].icon} />
                      </span>
                      <span>{SLIDE_KINDS[k].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          : (Object.keys(ELEMENT_GROUPS) as (keyof typeof ELEMENT_GROUPS)[]).map((g) => (
              <div key={g}>
                <div className="bbfa-palette__group">{ELEMENT_GROUPS[g]}</div>
                <div className="bbfa-palette__grid">
                  {(Object.keys(ELEMENTS) as ElementType[])
                    .filter((t) => ELEMENTS[t].group === g)
                    .map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="bbfa-palette__item"
                        disabled={!canSave || !selSlide}
                        title={selSlide ? ELEMENTS[t].desc : "Select a slide first"}
                        draggable={canSave}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/bbp-el", t);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => selSlide && addElement(selSlide.uid, t)}
                      >
                        <span className="bbfa-palette__icon">
                          <PIcon name={ELEMENTS[t].icon} />
                        </span>
                        <span>{ELEMENTS[t].label}</span>
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
              aria-label="Presentation name"
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
              {DECK_STATUSES.map((s) => (
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
                  <button type="button" className={`bbfa-btn${saving ? " is-loading" : ""}`} onClick={() => void save("active")}>
                    <span>Activate</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="bbfa-canvas__meta">
            {slides.length} {slides.length === 1 ? "slide" : "slides"} · {siteUrl.replace(/^https?:\/\//, "")}/p/{slug}
            {protectedDeck ? " · password" : ""}
            {live ? (
              <>
                {" "}
                · <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer">View live ↗</a>
              </>
            ) : null}
            {" "}
            · <a href={`/admin/preview/presentations/${deckId}`} target="_blank" rel="noopener noreferrer">Present ↗</a>
            {dirty ? " · save first to see changes there" : ""}
            {canSave ? null : " · view only"}
          </div>
          <div className="bbp-modebar">
            <label>Opens as</label>
            <div className="bbfa-seg" role="group" aria-label="Presenting mode">
              {(["slides", "accordion"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!canSave}
                  className={mode === m ? "is-active" : ""}
                  onClick={() => {
                    setMode(m);
                    touch();
                  }}
                >
                  <PIcon name={m === "slides" ? "slides" : "rows"} />
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <label>Layout</label>
            <div className="bbfa-seg" role="group" aria-label="Presenting layout">
              {(["landscape", "portrait", "auto"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={!canSave}
                  className={orientation === o ? "is-active" : ""}
                  onClick={() => {
                    setOrientation(o);
                    touch();
                  }}
                >
                  {o !== "auto" ? <PIcon name={o} /> : null}
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
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
                    disabled={i.slideIndex === undefined}
                    onClick={() => {
                      const s = i.slideIndex !== undefined ? slides[i.slideIndex] : undefined;
                      if (s) {
                        setSel({ s: s.uid, e: null });
                        scrollTo(s.uid);
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

        <div className="bbfa-blocks" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={() => (setDropAt(null), setDropEl(null))}>
          {!slides.length ? (
            <div className="bbfa-empty is-canvas">
              <div className="bbfa-empty__icon">
                B<i>*</i>
              </div>
              <h3>Your deck is empty</h3>
              <p>Start with a Cover slide, then add what the audience needs: structure, proof, a demo, a close.</p>
              {canSave ? (
                <button type="button" className="bbfa-btn" onClick={() => addSlide("cover")}>
                  + Add a cover
                </button>
              ) : null}
            </div>
          ) : null}
          {slides.map((s, i) => (
            <SlideCard
              key={s.uid}
              slide={s}
              index={i}
              total={slides.length}
              selected={sel?.s === s.uid}
              selEl={sel?.s === s.uid ? sel.e : null}
              dropBefore={dropAt === i}
              dropAfter={dropAt === slides.length && i === slides.length - 1}
              dropTarget={dropEl === s.uid}
              orientation={orientation}
              mode={mode}
              dark={dark}
              large={large}
              canSave={canSave}
              onSelect={select}
              onMove={moveSlide}
              onDuplicate={duplicateSlide}
              onRemove={removeSlide}
              onDragStart={startDrag}
              onDragEnd={endDrag}
              onHide={hideSlide}
            />
          ))}
          {slides.length && canSave ? (
            <div className="bbp-add">
              <button type="button" onClick={() => addSlide("bullets", slides.length)}>
                + Add slide
              </button>
            </div>
          ) : null}
        </div>
      </main>

      {/* Inspector */}
      <aside className="bbfa-inspector">
        {selSlide ? (
          <Inspector
            key={`${selSlide.uid}:${selEl?.uid ?? 0}`}
            slide={selSlide}
            slideIndex={slides.indexOf(selSlide)}
            el={selEl}
            readOnly={!canSave}
            portrait={portrait}
            ctx={ctx}
            onSlide={(k, v) => patchSlide(selSlide.uid, k, v)}
            onEl={(k, v) => selEl && patchElement(selSlide.uid, selEl.uid, k, v)}
            onPick={(e) => setSel({ s: selSlide.uid, e })}
            onAdd={(t) => addElement(selSlide.uid, t)}
            onMoveEl={(uid, d) => moveElement(selSlide.uid, uid, d)}
            onDupEl={(uid) => duplicateElement(selSlide.uid, uid)}
            onDelEl={(uid) => removeElement(selSlide.uid, uid)}
          />
        ) : (
          <div className="bbfa-inspector__empty">
            <div className="bbfa-empty__icon">
              <Icon name="edit" />
            </div>
            <h4>Select a slide</h4>
            <p>Click a slide to edit its layout, background and notes. Click an element on the slide to edit its content.</p>
            <div className="bbfa-shortcuts">
              <div>
                <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd> Save
              </div>
              <div>Drag slides to reorder</div>
              <div>Drag elements onto a slide</div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One slide card on the canvas                                               */
/* -------------------------------------------------------------------------- */

type CardProps = {
  slide: EditSlide;
  index: number;
  total: number;
  selected: boolean;
  selEl: number | null;
  dropBefore: boolean;
  dropAfter: boolean;
  dropTarget: boolean;
  orientation: DeckOrientation;
  mode: DeckMode;
  dark: boolean;
  large?: boolean;
  canSave: boolean;
  onSelect: (s: number, e: number | null) => void;
  onMove: (i: number, d: -1 | 1) => void;
  onDuplicate: (i: number) => void;
  onRemove: (uid: number) => void;
  onDragStart: (uid: number) => void;
  onDragEnd: () => void;
  onHide: (uid: number, hidden: boolean) => void;
};

const SlideCard = memo(function SlideCard({ slide, index, total, selected, selEl, dropBefore, dropAfter, dropTarget, orientation, mode, dark, large, canSave, onSelect, onMove, onDuplicate, onRemove, onDragStart, onDragEnd, onHide }: CardProps) {
  const K = SLIDE_KINDS[slide.kind];
  // The thumbnail uses the element's builder id as its data-el, so a click on it can be mapped back to the element.
  const view = useMemo<DeckSlide>(() => ({ id: slide.uid, kind: slide.kind, settings: slide.settings, elements: slide.elements.map((e) => ({ id: e.uid, type: e.type, settings: e.settings })) }), [slide]);
  const hidden = !!slide.settings.hidden;
  const click = (e: MouseEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest(".bbfa-block__tools")) return;
    if (t.closest("a")) e.preventDefault();
    const el = t.closest<HTMLElement>("[data-el]");
    onSelect(slide.uid, el ? Number(el.dataset.el) : null);
  };
  return (
    <div
      data-uid={slide.uid}
      tabIndex={0}
      draggable={canSave}
      className={`bbfa-block bbp-slide${selected ? " is-selected" : ""}${hidden ? " is-hidden" : ""}${dropBefore ? " drop-before" : ""}${dropAfter ? " drop-after" : ""}${dropTarget ? " drop-target" : ""}`}
      onClick={click}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onSelect(slide.uid, null)}
      onDragStart={(e) => {
        onDragStart(slide.uid);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "bbp");
      }}
      onDragEnd={onDragEnd}
    >
      {selected && selEl ? <style>{`.bbp-slide[data-uid="${slide.uid}"] [data-el="${selEl}"]{outline:2px solid #C72C2C!important;outline-offset:4px}`}</style> : null}
      <div className="bbfa-block__head">
        <span className="bbfa-grip">
          <Icon name="grip" />
        </span>
        <span className="bbp-num">{String(index + 1).padStart(2, "0")}</span>
        <span className="bbfa-block__type">
          <PIcon name={K.icon} />
          <span>{K.label}</span>
        </span>
        <span className="bbp-sname">{slideTitle(slide)}</span>
        <span className="bbfa-block__chips">
          {hidden ? <span className="bbfa-chip">skipped</span> : null}
          {slide.settings.bg === "inverse" ? <span className="bbfa-chip">dark band</span> : null}
          {slide.settings.bg === "image" ? <span className="bbfa-chip">picture</span> : null}
          {slide.settings.notes ? <span className="bbfa-chip">notes</span> : null}
          {slide.settings.anchor ? <span className="bbfa-chip">#{slide.settings.anchor}</span> : null}
        </span>
      </div>
      <div className={`bbp-thumb${orientation === "portrait" ? " is-portrait" : ""}`}>
        <SlideThumb slide={view} index={index} total={total} orientation={orientation} deckDark={dark} mode={mode} large={large} />
      </div>
      {canSave ? (
        <div className="bbfa-block__tools">
          <button type="button" title="Move up" disabled={index === 0} onClick={() => onMove(index, -1)}>
            <Icon name="up" />
          </button>
          <button type="button" title="Move down" disabled={index === total - 1} onClick={() => onMove(index, 1)}>
            <Icon name="down" />
          </button>
          <button type="button" title={hidden ? "Show this slide again" : "Skip when presenting"} onClick={() => onHide(slide.uid, !hidden)}>
            <Icon name="hidden" />
          </button>
          <button type="button" title="Duplicate" onClick={() => onDuplicate(index)}>
            <Icon name="copy" />
          </button>
          <button type="button" title="Delete" className="is-danger" onClick={() => onRemove(slide.uid)}>
            <Icon name="trash" />
          </button>
        </div>
      ) : null}
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Inspector                                                                  */
/* -------------------------------------------------------------------------- */

type InspectorProps = {
  slide: EditSlide;
  slideIndex: number;
  el: EditEl | null;
  readOnly: boolean;
  portrait: boolean;
  ctx: ControlCtx;
  onSlide: (key: string, value: unknown) => void;
  onEl: (key: string, value: unknown) => void;
  onPick: (uid: number | null) => void;
  onAdd: (type: ElementType) => void;
  onMoveEl: (uid: number, d: -1 | 1) => void;
  onDupEl: (uid: number) => void;
  onDelEl: (uid: number) => void;
};

function Inspector({ slide, slideIndex, el, readOnly, portrait, ctx, onSlide, onEl, onPick, onAdd, onMoveEl, onDupEl, onDelEl }: InspectorProps) {
  const K = SLIDE_KINDS[slide.kind];
  if (el) {
    const T = ELEMENTS[el.type];
    const content = T.controls.filter((c) => !PLACEMENT_KEYS.has(c.key));
    const placement = T.controls.filter((c) => PLACEMENT_KEYS.has(c.key));
    return (
      <>
        <div className="bbp-crumb">
          <button type="button" onClick={() => onPick(null)}>
            Slide {slideIndex + 1}
          </button>
          <span>›</span>
          <span>{T.label}</span>
        </div>
        <div className="bbfa-inspector__head">
          <span className="bbfa-palette__icon">
            <PIcon name={T.icon} />
          </span>
          <div>
            <div className="bbfa-eyebrow">Element</div>
            <h3>{T.label}</h3>
          </div>
        </div>
        <p className="bbfa-inspector__desc">{T.desc}</p>
        {!readOnly ? (
          <div className="bbp-actions" style={{ padding: "12px 20px 0" }}>
            <button type="button" className="bbfa-mini" onClick={() => onMoveEl(el.uid, -1)}>
              Move up
            </button>
            <button type="button" className="bbfa-mini" onClick={() => onMoveEl(el.uid, 1)}>
              Move down
            </button>
            <button type="button" className="bbfa-mini" onClick={() => onDupEl(el.uid)}>
              Duplicate
            </button>
            <button type="button" className="bbfa-mini" onClick={() => onDelEl(el.uid)}>
              Delete
            </button>
          </div>
        ) : null}
        <fieldset className="bbfa-inspector__body" disabled={readOnly} style={{ border: 0, margin: 0, minWidth: 0 }}>
          {content.map((c) => (
            <ControlField key={c.key} control={c} settings={el.settings} set={onEl} ctx={ctx} />
          ))}
          {placement.length ? (
            <details className="bbfa-layout">
              <summary>Placement and appearance</summary>
              {placement.map((c) => (
                <ControlField key={c.key} control={c} settings={el.settings} set={onEl} ctx={ctx} />
              ))}
            </details>
          ) : null}
        </fieldset>
      </>
    );
  }

  const look = SLIDE_CONTROLS.filter((c) => SLIDE_LOOK_KEYS.has(c.key));
  const accordion = SLIDE_CONTROLS.filter((c) => SLIDE_ACCORDION_KEYS.has(c.key));
  const rest = SLIDE_CONTROLS.filter((c) => !SLIDE_LOOK_KEYS.has(c.key) && !SLIDE_ACCORDION_KEYS.has(c.key));
  const naming = rest.filter((c) => c.key === "title");
  const flow = rest.filter((c) => c.key !== "title");
  const bgImage = slide.settings.bg === "image";
  return (
    <>
      <div className="bbfa-inspector__head">
        <span className="bbfa-palette__icon">
          <PIcon name={K.icon} />
        </span>
        <div>
          <div className="bbfa-eyebrow">Slide {slideIndex + 1}</div>
          <h3>{K.label}</h3>
        </div>
      </div>
      <p className="bbfa-inspector__desc">{K.desc}</p>
      <fieldset className="bbfa-inspector__body" disabled={readOnly} style={{ border: 0, margin: 0, minWidth: 0 }}>
        {naming.map((c) => (
          <ControlField key={c.key} control={c} settings={slide.settings} set={onSlide} ctx={ctx} />
        ))}

        <div className="bbp-sub">Elements on this slide</div>
        {slide.elements.length ? (
          <ul className="bbp-els">
            {slide.elements.map((e, i) => (
              <li key={e.uid}>
                <button type="button" className="bbp-pick" onClick={() => onPick(e.uid)}>
                  <PIcon name={ELEMENTS[e.type].icon} />
                  <span>
                    {ELEMENTS[e.type].label}
                    <small>{elementLabel(e)}</small>
                  </span>
                </button>
                {!readOnly ? (
                  <>
                    <button type="button" className="bbp-mini" title="Move up" disabled={i === 0} onClick={() => onMoveEl(e.uid, -1)}>
                      <Icon name="up" />
                    </button>
                    <button type="button" className="bbp-mini" title="Move down" disabled={i === slide.elements.length - 1} onClick={() => onMoveEl(e.uid, 1)}>
                      <Icon name="down" />
                    </button>
                    <button type="button" className="bbp-mini" title="Delete" onClick={() => onDelEl(e.uid)}>
                      <Icon name="trash" />
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="bbfa-muted" style={{ margin: 0, fontSize: 12.5 }}>
            No elements yet.
          </p>
        )}
        {!readOnly ? (
          <select
            className="bbp-addel bbfa-status-select"
            value=""
            aria-label="Add an element to this slide"
            onChange={(e) => {
              if (isElementType(e.target.value)) onAdd(e.target.value);
            }}
          >
            <option value="">+ Add an element…</option>
            {(Object.keys(ELEMENT_GROUPS) as (keyof typeof ELEMENT_GROUPS)[]).map((g) => (
              <optgroup key={g} label={ELEMENT_GROUPS[g]}>
                {(Object.keys(ELEMENTS) as ElementType[])
                  .filter((t) => ELEMENTS[t].group === g)
                  .map((t) => (
                    <option key={t} value={t}>
                      {ELEMENTS[t].label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        ) : null}

        <details className="bbfa-layout" open>
          <summary>Look</summary>
          {look.map((c) => {
            if ((c.key === "bg_image" || c.key === "bg_dim" || c.key === "bg_mono") && !bgImage) return null;
            if (c.key === "layout" && portrait) return <ControlField key={c.key} control={{ ...c, help: "Two columns stack into one on a portrait deck." }} settings={slide.settings} set={onSlide} ctx={ctx} />;
            return <ControlField key={c.key} control={c} settings={slide.settings} set={onSlide} ctx={ctx} />;
          })}
        </details>
        <details className="bbfa-layout">
          <summary>Accordion mode</summary>
          {accordion.map((c) => (
            <ControlField key={c.key} control={c} settings={slide.settings} set={onSlide} ctx={ctx} />
          ))}
        </details>
        <details className="bbfa-layout" open={!!slide.settings.notes}>
          <summary>Notes, anchor and visibility</summary>
          {flow.map((c) => (
            <ControlField key={c.key} control={c} settings={slide.settings} set={onSlide} ctx={ctx} />
          ))}
        </details>
      </fieldset>
    </>
  );
}
