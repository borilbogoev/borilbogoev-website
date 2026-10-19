"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BLOCK_TYPES, GROUPS, LOGIC_OP_LABELS, blockDefaults, isBlockType, isInput, type Block, type BlockType, type Control, type LogicOp, type Settings } from "../lib/blocks";
import { cleanKey } from "../lib/sanitize";
import { FORM_STATUSES } from "../lib/settings";
import { api, ApiError, Icon, useConfirm, useToast } from "./ui";

type EditBlock = Block & { uid: number; auto: boolean };

type Props = {
  formId: number;
  initialTitle: string;
  initialStatus: string;
  initialBlocks: Block[];
  accent: string;
  canSave: boolean;
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

let uidCounter = 0;
const nextUid = () => ++uidCounter;

/** Program names for blocks of the form: contact sub-fields and input blocks. */
function usedKeys(blocks: EditBlock[], except?: EditBlock) {
  const used = new Set<string>();
  for (const b of blocks) {
    if (b === except) continue;
    if (b.type === "contact") for (const f of Object.values((b.settings.fields ?? {}) as Record<string, { enabled: number; key: string }>)) if (f.enabled) used.add(f.key);
    if (b.fieldKey) used.add(b.fieldKey);
  }
  return used;
}

function uniqueKey(base: string, blocks: EditBlock[], except?: EditBlock) {
  const root = cleanKey(base).slice(0, 40) || "field";
  const used = usedKeys(blocks, except);
  let k = root;
  let i = 2;
  while (used.has(k)) k = `${root}_${i++}`;
  return k;
}

export function Builder({ formId, initialTitle, initialStatus, initialBlocks, accent, canSave }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const prep = (b: Block): EditBlock => ({ ...b, uid: nextUid(), auto: false });

  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [blocks, setBlocks] = useState<EditBlock[]>(() => initialBlocks.map(prep));
  const [sel, setSel] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const dragUid = useRef<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const touch = () => setDirty(true);
  const selected = blocks.find((b) => b.uid === sel) ?? null;

  /* ---------- block operations ---------- */

  const add = (type: BlockType, at?: number) => {
    const b: EditBlock = { id: 0, type, fieldKey: "", settings: blockDefaults(type), uid: nextUid(), auto: true };
    setBlocks((cur) => {
      if (isInput(type) && type !== "contact") b.fieldKey = uniqueKey(String(b.settings.question ?? type), cur, b);
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
      const src = cur[i];
      const copy: EditBlock = { ...clone(src), id: 0, uid: nextUid(), auto: false };
      if (copy.fieldKey) copy.fieldKey = uniqueKey(copy.fieldKey, cur, copy);
      const next = [...cur];
      next.splice(i + 1, 0, copy);
      setSel(copy.uid);
      return next;
    });
    touch();
  };

  const remove = async (i: number) => {
    const b = blocks[i];
    if (isInput(b.type) && b.id && !(await confirm("Delete this field? Existing responses keep their stored values, but the column will disappear from tables and charts.", "Delete field"))) return;
    setBlocks((cur) => cur.filter((x) => x.uid !== b.uid));
    if (sel === b.uid) setSel(null);
    touch();
  };

  const patchBlock = (u: number, fn: (b: EditBlock) => EditBlock) => {
    setBlocks((cur) => cur.map((b) => (b.uid === u ? fn(b) : b)));
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
    if (nt && isBlockType(nt)) return add(nt, at);
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

  const save = useCallback(async () => {
    if (saving || !canSave) return;
    setSaving(true);
    const selIndex = blocks.findIndex((b) => b.uid === sel);
    try {
      const res = await api<{ blocks: Block[]; form: { title: string } }>(`forms/${formId}`, {
        method: "PUT",
        body: { title, status, blocks: blocks.map((b) => ({ id: b.id, type: b.type, fieldKey: b.fieldKey, settings: b.settings })) },
      });
      const next = res.blocks.map(prep);
      setBlocks(next);
      setSel(selIndex > -1 && next[selIndex] ? next[selIndex].uid : null);
      setDirty(false);
      toast("Form saved");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }, [saving, canSave, blocks, sel, formId, title, status, toast]);

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

  const hasContact = blocks.some((b) => b.type === "contact");
  const nQ = blocks.filter((b) => isInput(b.type)).length;
  const nP = 1 + blocks.filter((b) => b.type === "page_break").length;
  let page = 1;

  return (
    <div className="bbfa-builder">
      {/* Palette */}
      <aside className="bbfa-palette">
        <div className="bbfa-palette__head">
          <div className="bbfa-eyebrow">Blocks</div>
          <p>Click to add below the selected block.</p>
        </div>
        {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
          <div key={g}>
            <div className="bbfa-palette__group">{GROUPS[g]}</div>
            <div className="bbfa-palette__grid">
              {(Object.keys(BLOCK_TYPES) as BlockType[])
                .filter((t) => BLOCK_TYPES[t].group === g)
                .map((t) => {
                  const dis = !!BLOCK_TYPES[t].unique && hasContact;
                  return (
                    <button
                      key={t}
                      type="button"
                      className="bbfa-palette__item"
                      disabled={dis || !canSave}
                      title={dis ? "Only one per form" : `Add ${BLOCK_TYPES[t].label}`}
                      draggable={!dis && canSave}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/bbf-new", t);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => add(t)}
                    >
                      <span className="bbfa-palette__icon">
                        <Icon name={BLOCK_TYPES[t].icon} />
                      </span>
                      <span>{BLOCK_TYPES[t].label}</span>
                    </button>
                  );
                })}
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
              aria-label="Form name"
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
              onChange={(e) => {
                setStatus(e.target.value);
                touch();
              }}
            >
              {FORM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            {canSave ? (
              <button type="button" className={`bbfa-btn${saving ? " is-loading" : ""}${dirty ? " is-dirty" : ""}`} onClick={save}>
                <span>Save</span>
              </button>
            ) : null}
          </div>
          <div className="bbfa-canvas__meta">
            {blocks.length} blocks · {nQ} fields · {nP} {nP > 1 ? "pages" : "page"}
            {canSave ? null : " · view only"}
          </div>
        </div>

        <div className="bbfa-blocks" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={() => setDropAt(null)}>
          {!blocks.length ? (
            <div className="bbfa-empty is-canvas">
              <div className="bbfa-empty__icon">
                B<i>*</i>
              </div>
              <h3>Your canvas is empty</h3>
              <p>Add blocks from the left panel. Use Page Break to split the form into steps.</p>
            </div>
          ) : null}
          <div className="bbfa-page-label">Page 1</div>
          {blocks.map((b, i) => {
            const T = BLOCK_TYPES[b.type];
            if (b.type === "page_break") page++;
            return (
              <div
                key={b.uid}
                data-uid={b.uid}
                tabIndex={0}
                draggable={canSave}
                className={`bbfa-block${sel === b.uid ? " is-selected" : ""}${b.type === "page_break" ? " is-break" : ""}${T.input ? " is-input" : ""}${dropAt === i ? " drop-before" : ""}${dropAt === blocks.length && i === blocks.length - 1 ? " drop-after" : ""}`}
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
                {b.type === "page_break" ? (
                  <div className="bbfa-break">
                    <span className="bbfa-grip">
                      <Icon name="grip" />
                    </span>
                    <Icon name="pagebreak" />
                    <strong>Page break</strong>
                    <em>
                      {b.settings.next_label ? `"${b.settings.next_label}" → ` : ""}Page {page}
                    </em>
                  </div>
                ) : (
                  <>
                    <div className="bbfa-block__head">
                      <span className="bbfa-grip">
                        <Icon name="grip" />
                      </span>
                      <span className="bbfa-block__type">
                        <Icon name={T.icon} />
                        <span>{T.label}</span>
                      </span>
                      <span className="bbfa-block__chips">
                        <Chips b={b} />
                      </span>
                    </div>
                    <Summary b={b} accent={accent} />
                  </>
                )}
                {canSave ? (
                  <div className="bbfa-block__tools">
                    <button type="button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <Icon name="up" />
                    </button>
                    <button type="button" title="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                      <Icon name="down" />
                    </button>
                    <button type="button" title="Duplicate" disabled={!!T.unique} onClick={() => duplicate(i)}>
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
        {canSave ? (
          <div className="bbfa-canvas__foot">
            <button
              type="button"
              className="bbfa-btn bbfa-btn--ghost"
              onClick={() => {
                setSel(null);
                add("short_text", blocks.length);
              }}
            >
              <Icon name="plus" /> Add a question
            </button>
          </div>
        ) : null}
      </main>

      {/* Inspector */}
      <aside className="bbfa-inspector">
        {selected ? (
          <Inspector
            key={selected.uid}
            block={selected}
            blocks={blocks}
            readOnly={!canSave}
            onChange={(fn) => patchBlock(selected.uid, fn)}
          />
        ) : (
          <div className="bbfa-inspector__empty">
            <div className="bbfa-empty__icon">
              <Icon name="edit" />
            </div>
            <h4>Select a block</h4>
            <p>Click any block on the canvas to edit its content and settings.</p>
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
/* Canvas card pieces                                                         */
/* -------------------------------------------------------------------------- */

function Chips({ b }: { b: EditBlock }) {
  const s = b.settings;
  return (
    <>
      {b.fieldKey ? <span className="bbfa-chip is-key">{b.fieldKey}</span> : null}
      {b.type === "choice" && s.multiple ? <span className="bbfa-chip">multi{s.max_select ? ` ≤${s.max_select}` : ""}</span> : null}
      {s.order && s.order !== "defined" ? <span className="bbfa-chip">{s.order === "random" ? "shuffled" : "A-Z"}</span> : null}
      {s.logic?.enabled && s.logic.field ? (
        <span className="bbfa-chip is-logic">
          <Icon name="logic" />
          if {s.logic.field}
        </span>
      ) : null}
    </>
  );
}

function Summary({ b, accent }: { b: EditBlock; accent: string }) {
  const s = b.settings;
  const q = (
    <>
      <div className="bbfa-prev-q">
        {s.question}
        {s.required ? <span className="bbfa-req">*</span> : null}
      </div>
      {s.description ? <div className="bbfa-prev-desc">{String(s.description).slice(0, 120)}</div> : null}
    </>
  );
  switch (b.type) {
    case "heading":
      return (
        <div className="bbfa-card-body">
          {s.eyebrow ? <div className="bbfa-eyebrow">{s.eyebrow}</div> : null}
          <div className={`bbfa-prev-title is-${s.level}`}>
            {s.text}
            {s.accent_dot ? <span className="bbfa-dot">.</span> : null}
          </div>
        </div>
      );
    case "text":
      return (
        <div className="bbfa-card-body">
          <div className="bbfa-prev-text">{String(s.content ?? "").replace(/[#*_`>[\]]|\(http[^)]*\)/g, "").slice(0, 220)}</div>
        </div>
      );
    case "image":
      return <div className="bbfa-card-body">{s.image?.url ? <img className="bbfa-prev-img" src={s.image.url} alt="" /> : <div className="bbfa-prev-empty">No image selected</div>}</div>;
    case "divider":
      return (
        <div className="bbfa-card-body">
          {s.style === "dots" ? (
            <div className="bbfa-prev-dots" style={{ color: s.color }}>
              <i />
              <i />
              <i />
            </div>
          ) : (
            <div className="bbfa-prev-line" style={{ borderTop: `${Math.max(1, s.thickness)}px ${s.style === "accent" ? "solid" : s.style} ${s.style === "accent" ? accent : s.color}`, width: s.style === "accent" ? 48 : `${s.width}%` }} />
          )}
        </div>
      );
    case "spacer":
      return (
        <div className="bbfa-card-body">
          <div className="bbfa-prev-spacer" style={{ height: Math.min(80, s.height) }}>
            {s.height}px
          </div>
        </div>
      );
    case "page_break":
      return null;
    case "choice":
    case "dropdown":
      return (
        <div className="bbfa-card-body">
          {q}
          <div className="bbfa-prev-opts">
            {((s.options as string[]) ?? []).slice(0, 8).map((o, i) => (
              <span key={i}>
                <b>{String.fromCharCode(65 + i)}</b>
                {o}
              </span>
            ))}
            {s.allow_other ? (
              <span>
                <b>+</b>Other
              </span>
            ) : null}
          </div>
        </div>
      );
    case "yes_no":
      return (
        <div className="bbfa-card-body">
          {q}
          <div className="bbfa-prev-opts">
            <span>
              <b>Y</b>
              {s.yes_label}
            </span>
            <span>
              <b>N</b>
              {s.no_label}
            </span>
          </div>
        </div>
      );
    case "rating":
      return (
        <div className="bbfa-card-body">
          {q}
          <div className="bbfa-prev-stars">
            {Array.from({ length: Number(s.max) }, (_, i) => (
              <Icon key={i} name="star" />
            ))}
          </div>
        </div>
      );
    case "scale":
      return (
        <div className="bbfa-card-body">
          {q}
          <div className="bbfa-prev-scale">
            {Array.from({ length: Number(s.max) - Number(s.min) + 1 }, (_, i) => (
              <i key={i}>{Number(s.min) + i}</i>
            ))}
          </div>
        </div>
      );
    case "contact": {
      const f = (s.fields ?? {}) as Record<string, { enabled: number; required: number; label: string }>;
      return (
        <div className="bbfa-card-body">
          {q}
          <div className="bbfa-prev-opts">
            {Object.keys(f)
              .filter((k) => f[k].enabled)
              .map((k) => (
                <span key={k}>
                  {f[k].label}
                  {f[k].required ? <em>*</em> : null}
                </span>
              ))}
          </div>
        </div>
      );
    }
    case "consent":
      return (
        <div className="bbfa-card-body">
          <div className="bbfa-prev-consent">
            <i />
            {String(s.text ?? "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")}
          </div>
        </div>
      );
    case "hidden":
      return (
        <div className="bbfa-card-body">
          <div className="bbfa-prev-desc">{s.param ? `Filled from ?${s.param}=` : `Default: ${s.default || "(empty)"}`}</div>
        </div>
      );
    default:
      return (
        <div className="bbfa-card-body">
          {q}
          <div className="bbfa-prev-input">{s.placeholder || (b.type === "long_text" ? "Long answer..." : b.type === "file" ? "Upload a file" : b.type === "date" ? "YYYY-MM-DD" : "Answer...")}</div>
        </div>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Inspector                                                                  */
/* -------------------------------------------------------------------------- */

function Inspector({ block, blocks, readOnly, onChange }: { block: EditBlock; blocks: EditBlock[]; readOnly: boolean; onChange: (fn: (b: EditBlock) => EditBlock) => void }) {
  const T = BLOCK_TYPES[block.type];
  const set = (key: string, value: unknown) =>
    onChange((b) => {
      const next: EditBlock = { ...b, settings: { ...b.settings, [key]: value } };
      // The program name follows the question until the user edits it by hand.
      if (key === "question" && b.auto && b.type !== "contact" && isInput(b.type)) next.fieldKey = uniqueKey(String(value) || b.type, blocks, b);
      return next;
    });
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
      <fieldset className="bbfa-inspector__body" disabled={readOnly} style={{ border: 0, margin: 0, minWidth: 0 }}>
        {T.controls.map((c) => (
          <ControlView key={c.key} control={c} block={block} blocks={blocks} set={set} onChange={onChange} />
        ))}
      </fieldset>
    </>
  );
}

function ControlView({ control: c, block: b, blocks, set, onChange }: { control: Control; block: EditBlock; blocks: EditBlock[]; set: (k: string, v: unknown) => void; onChange: (fn: (b: EditBlock) => EditBlock) => void }) {
  const s = b.settings;
  if (c.show_if && !s[c.show_if]) return null;
  const v = s[c.key];

  switch (c.type) {
    case "text":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <input type="text" value={v === undefined ? "" : String(v)} onChange={(e) => set(c.key, e.target.value)} />
        </div>
      );
    case "textarea":
    case "markdown":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <textarea rows={c.type === "markdown" ? 6 : 3} value={String(v ?? "")} onChange={(e) => set(c.key, e.target.value)} />
          {c.type === "markdown" || /Markdown/.test(c.label) ? (
            <small>
              <b>**bold**</b> · <i>*italic*</i> · [link](https://) · - list · # heading
            </small>
          ) : null}
        </div>
      );
    case "number":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <input type="number" value={v as number} min={c.min} max={c.max} onChange={(e) => set(c.key, e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
      );
    case "select":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <select value={String(v)} onChange={(e) => set(c.key, e.target.value)}>
            {Object.entries(c.choices ?? {}).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
      );
    case "toggle":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-toggle">
            <input type="checkbox" checked={!!v} onChange={(e) => set(c.key, e.target.checked ? 1 : 0)} />
            <span className="bbfa-toggle__ui" />
            <span className="bbfa-label">{c.label}</span>
          </label>
        </div>
      );
    case "color":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <div className="bbfa-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : "#E6E6E6"} onChange={(e) => set(c.key, e.target.value.toUpperCase())} />
            <input type="text" value={String(v ?? "")} maxLength={7} onChange={(e) => set(c.key, e.target.value)} />
          </div>
        </div>
      );
    case "field_key":
      return <FieldKeyControl label={c.label} block={b} blocks={blocks} onChange={onChange} />;
    case "options":
      return <OptionsControl label={c.label} options={(v as string[]) ?? []} onChange={(o) => set(c.key, o)} />;
    case "image":
      return <ImageControl label={c.label} value={(v as { id: number; url: string }) ?? { id: 0, url: "" }} onChange={(img) => set(c.key, img)} />;
    case "contact_fields":
      return <ContactFieldsControl label={c.label} fields={(v ?? s.fields) as Settings} onChange={(f) => set("fields", f)} />;
    case "logic":
      return <LogicControl block={b} blocks={blocks} onChange={(l) => set("logic", l)} />;
  }
  return null;
}

function FieldKeyControl({ label, block, blocks, onChange }: { label: string; block: EditBlock; blocks: EditBlock[]; onChange: (fn: (b: EditBlock) => EditBlock) => void }) {
  const [draft, setDraft] = useState(block.fieldKey);
  const clash = usedKeys(blocks, block).has(draft);
  return (
    <div className="bbfa-ctl">
      <label className="bbfa-label">{label}</label>
      <div className="bbfa-inline">
        <input
          type="text"
          className="bbfa-key-input"
          spellCheck={false}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange((b) => ({ ...b, auto: false, fieldKey: e.target.value }));
          }}
          onBlur={() => {
            const k = cleanKey(draft) || uniqueKey(String(block.settings.question ?? block.type), blocks, block);
            setDraft(k);
            onChange((b) => ({ ...b, fieldKey: k }));
          }}
        />
        <button
          type="button"
          className="bbfa-mini"
          title="Generate from question"
          onClick={() => {
            const k = uniqueKey(String(block.settings.question ?? block.type), blocks, block);
            setDraft(k);
            onChange((b) => ({ ...b, auto: true, fieldKey: k }));
          }}
        >
          Auto
        </button>
      </div>
      <small>Used for database mapping, CSV columns, webhooks and merge tags.</small>
      {clash ? <small className="bbfa-warn">This name is already used. It will be suffixed on save.</small> : null}
    </div>
  );
}

function OptionsControl({ label, options, onChange }: { label: string; options: string[]; onChange: (o: string[]) => void }) {
  const [bulk, setBulk] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current !== null) {
      refs.current[focusNext.current]?.focus();
      focusNext.current = null;
    }
  });
  const setAt = (i: number, val: string) => onChange(options.map((o, k) => (k === i ? val : o)));
  return (
    <div className="bbfa-ctl">
      <label className="bbfa-label">{label}</label>
      {bulk === null ? (
        <div className="bbfa-opts">
          {options.map((o, i) => (
            <div className="bbfa-opt" key={i}>
              <b>{String.fromCharCode(65 + (i % 26))}</b>
              <input
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="text"
                value={o}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const next = [...options];
                    next.splice(i + 1, 0, "");
                    focusNext.current = i + 1;
                    onChange(next);
                  }
                }}
              />
              <button
                type="button"
                title="Up"
                disabled={!i}
                onClick={() => {
                  const next = [...options];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(next);
                }}
              >
                <Icon name="up" />
              </button>
              <button type="button" title="Remove" onClick={() => onChange(options.filter((_, k) => k !== i))}>
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <textarea className="bbfa-bulk" rows={6} value={bulk} placeholder="One option per line" onChange={(e) => setBulk(e.target.value)} />
      )}
      <div className="bbfa-inline">
        {bulk === null ? (
          <button type="button" className="bbfa-mini" onClick={() => onChange([...options, `Option ${String.fromCharCode(65 + (options.length % 26))}`])}>
            <Icon name="plus" /> Add option
          </button>
        ) : null}
        <button
          type="button"
          className="bbfa-mini is-ghost"
          onClick={() => {
            if (bulk === null) setBulk(options.join("\n"));
            else {
              onChange(bulk.split("\n").map((x) => x.trim()).filter(Boolean));
              setBulk(null);
            }
          }}
        >
          {bulk === null ? "Bulk edit" : "Apply"}
        </button>
      </div>
    </div>
  );
}

function ImageControl({ label, value, onChange }: { label: string; value: { id: number; url: string }; onChange: (v: { id: number; url: string }) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/forms/media", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      onChange({ id: 0, url: json.url });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bbfa-ctl bbfa-ctl--image">
      <label className="bbfa-label">{label}</label>
      <div className="bbfa-img-prev">{value.url ? <img src={value.url} alt="" /> : <span>No image</span>}</div>
      <div className="bbfa-inline">
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button type="button" className="bbfa-mini" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? "Uploading..." : value.url ? "Replace image" : "Upload image"}
        </button>
        {value.url ? (
          <button type="button" className="bbfa-mini is-ghost" onClick={() => onChange({ id: 0, url: "" })}>
            Remove
          </button>
        ) : null}
      </div>
      <input type="url" value={value.url} placeholder="https://... or upload" onChange={(e) => onChange({ id: 0, url: e.target.value })} />
    </div>
  );
}

function ContactFieldsControl({ label, fields, onChange }: { label: string; fields: Settings; onChange: (f: Settings) => void }) {
  const patch = (k: string, p: Settings) => onChange({ ...fields, [k]: { ...fields[k], ...p } });
  return (
    <div className="bbfa-ctl">
      <label className="bbfa-label">{label}</label>
      <div className="bbfa-cfields">
        {Object.keys(fields).map((k) => {
          const f = fields[k];
          return (
            <div key={k} className={`bbfa-cfield${f.enabled ? "" : " is-off"}`}>
              <label className="bbfa-toggle is-sm" title="Show field">
                <input type="checkbox" checked={!!f.enabled} onChange={(e) => patch(k, { enabled: e.target.checked ? 1 : 0 })} />
                <span className="bbfa-toggle__ui" />
              </label>
              <div className="bbfa-cfield__main">
                <input type="text" value={f.label} onChange={(e) => patch(k, { label: e.target.value })} />
                <input type="text" className="is-key" spellCheck={false} value={f.key} onChange={(e) => patch(k, { key: e.target.value })} onBlur={(e) => patch(k, { key: cleanKey(e.target.value) || k })} />
              </div>
              <label className="bbfa-req-toggle" title="Required">
                <input type="checkbox" checked={!!f.required} onChange={(e) => patch(k, { required: e.target.checked ? 1 : 0 })} />
                <span>Req.</span>
              </label>
            </div>
          );
        })}
      </div>
      <small>Toggle fields on/off, rename labels, and set program names (second line) per field.</small>
    </div>
  );
}

function LogicControl({ block, blocks, onChange }: { block: EditBlock; blocks: EditBlock[]; onChange: (l: Settings) => void }) {
  const L = (block.settings.logic ?? { enabled: 0, field: "", op: "equals", value: "" }) as { enabled: number; field: string; op: LogicOp; value: string };
  const idx = blocks.findIndex((b) => b.uid === block.uid);
  const prevFields = useMemo(() => {
    const out: { key: string; label: string; opts: string[] }[] = [];
    for (const pb of blocks.slice(0, idx)) {
      if (pb.type === "contact") {
        for (const f of Object.values((pb.settings.fields ?? {}) as Record<string, { enabled: number; key: string; label: string }>)) if (f.enabled) out.push({ key: f.key, label: f.label, opts: [] });
      } else if (isInput(pb.type) && pb.fieldKey) {
        const ps = pb.settings;
        let opts: string[] = [];
        if (pb.type === "choice" || pb.type === "dropdown") opts = ps.options ?? [];
        if (pb.type === "yes_no") opts = [ps.yes_label, ps.no_label];
        if (pb.type === "consent") opts = ["Yes", "No"];
        out.push({ key: pb.fieldKey, label: ps.question || pb.fieldKey, opts });
      }
    }
    return out;
  }, [blocks, idx]);
  const src = prevFields.find((f) => f.key === L.field);
  const set = (p: Partial<typeof L>) => onChange({ ...L, ...p });
  return (
    <div className="bbfa-ctl">
      <label className="bbfa-toggle">
        <input type="checkbox" checked={!!L.enabled} onChange={(e) => set({ enabled: e.target.checked ? 1 : 0 })} />
        <span className="bbfa-toggle__ui" />
        <span className="bbfa-label">
          <Icon name="logic" /> Show only if...
        </span>
      </label>
      {L.enabled ? (
        prevFields.length ? (
          <div className="bbfa-logic">
            <select value={L.field} onChange={(e) => set({ field: e.target.value })}>
              <option value="">Choose a field...</option>
              {prevFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label} ({f.key})
                </option>
              ))}
            </select>
            <select value={L.op} onChange={(e) => set({ op: e.target.value as LogicOp })}>
              {(Object.keys(LOGIC_OP_LABELS) as LogicOp[]).map((k) => (
                <option key={k} value={k}>
                  {LOGIC_OP_LABELS[k]}
                </option>
              ))}
            </select>
            {L.op === "empty" || L.op === "not_empty" ? null : src?.opts.length && (L.op === "equals" || L.op === "not_equals") ? (
              <select value={L.value} onChange={(e) => set({ value: e.target.value })}>
                <option value="">Choose...</option>
                {src.opts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" value={L.value} placeholder="Value" onChange={(e) => set({ value: e.target.value })} />
            )}
          </div>
        ) : (
          <small className="bbfa-warn">Add a question above this block to build a condition.</small>
        )
      ) : null}
    </div>
  );
}
