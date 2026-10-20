"use client";

// The inspector controls shared by every block builder (Forms, Landing Pages): one place renders a Control from the block registry.
// Forms-only controls (program name, contact fields, conditional logic) stay in builder.tsx.
import { useEffect, useRef, useState } from "react";
import type { Control, Settings } from "../lib/blocks";
import { Icon, useToast } from "./ui";

export type ControlCtx = {
  /** Where pictures are uploaded (POST multipart `file`, answers `{ url, width?, height?, variants? }`). */
  uploadUrl: string;
  /** Forms that can be picked by a `form` control. */
  forms?: { id: number; title: string }[];
};

export type ImageValue = { id: number; url: string; width?: number; height?: number; variants?: { w: number; url: string }[] };

type Props = { control: Control; settings: Settings; set: (key: string, value: unknown) => void; ctx: ControlCtx };

/** One control of a block. Returns nothing for the controls only Forms knows (field_key, contact_fields, logic). */
export function ControlField({ control: c, settings: s, set, ctx }: Props) {
  if (c.show_if && !s[c.show_if]) return null;
  const v = s[c.key];
  const hint = c.help ? <small>{c.help}</small> : null;

  switch (c.type) {
    case "text":
    case "url":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <input type="text" value={v === undefined ? "" : String(v)} placeholder={c.type === "url" ? "/path, #anchor or https://" : undefined} onChange={(e) => set(c.key, e.target.value)} />
          {hint}
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
          {hint}
        </div>
      );
    case "number":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <input type="number" value={v as number} min={c.min} max={c.max} onChange={(e) => set(c.key, e.target.value === "" ? "" : Number(e.target.value))} />
          {hint}
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
          {hint}
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
          {hint}
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
    case "options":
      return <OptionsControl label={c.label} options={(v as string[]) ?? []} onChange={(o) => set(c.key, o)} />;
    case "image":
      return <ImageControl label={c.label} value={(v as ImageValue) ?? { id: 0, url: "" }} uploadUrl={ctx.uploadUrl} onChange={(img) => set(c.key, img)} />;
    case "form":
      return (
        <div className="bbfa-ctl">
          <label className="bbfa-label">{c.label}</label>
          <select value={String(v || 0)} onChange={(e) => set(c.key, Number(e.target.value))}>
            <option value="0">Choose a form...</option>
            {(ctx.forms ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.title} (#{f.id})
              </option>
            ))}
          </select>
          {hint ?? <small>Forms are built in the Forms module. Answers land in that form&apos;s responses.</small>}
        </div>
      );
    case "items":
      return <ItemsControl control={c} items={(v as Settings[]) ?? []} ctx={ctx} onChange={(items) => set(c.key, items)} />;
  }
  return null;
}

/* -------------------------------------------------------------------------- */

function blankItem(fields: Control[]): Settings {
  const out: Settings = {};
  for (const f of fields) {
    if (f.type === "items") out[f.key] = [];
    else if (f.default !== undefined) out[f.key] = JSON.parse(JSON.stringify(f.default));
    else out[f.key] = f.type === "toggle" || f.type === "number" || f.type === "form" ? 0 : f.type === "image" ? { id: 0, url: "" } : f.type === "options" ? [] : "";
  }
  return out;
}

/** A repeating group of controls: cards of a grid, plans of a pricing table, questions of a FAQ. */
function ItemsControl({ control: c, items, ctx, onChange }: { control: Control; items: Settings[]; ctx: ControlCtx; onChange: (items: Settings[]) => void }) {
  const fields = c.fields ?? [];
  const [open, setOpen] = useState<number | null>(items.length ? 0 : null);
  const max = c.max ?? 24;
  const patch = (i: number, key: string, value: unknown) => onChange(items.map((it, k) => (k === i ? { ...it, [key]: value } : it)));
  const title = (it: Settings, i: number) => {
    const raw = c.item_label ? it[c.item_label] : "";
    const t = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
    return t ? (t.length > 46 ? `${t.slice(0, 45)}…` : t) : `${c.label.replace(/s$/i, "")} ${i + 1}`;
  };
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(j);
  };
  return (
    <div className="bbfa-ctl bbfa-ctl--items">
      <label className="bbfa-label">
        {c.label} <em className="bbfa-count-sm">{items.length}</em>
      </label>
      <div className="bbfa-items">
        {items.map((it, i) => (
          <div key={i} className={`bbfa-item${open === i ? " is-open" : ""}`}>
            <div className="bbfa-item__head">
              <button type="button" className="bbfa-item__title" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <b>{i + 1}</b>
                <span>{title(it, i)}</span>
                <Icon name={open === i ? "up" : "down"} />
              </button>
              <span className="bbfa-item__tools">
                <button type="button" title="Move up" disabled={!i} onClick={() => swap(i, i - 1)}>
                  <Icon name="up" />
                </button>
                <button type="button" title="Move down" disabled={i === items.length - 1} onClick={() => swap(i, i + 1)}>
                  <Icon name="down" />
                </button>
                <button
                  type="button"
                  title="Duplicate"
                  disabled={items.length >= max}
                  onClick={() => {
                    const next = [...items];
                    next.splice(i + 1, 0, JSON.parse(JSON.stringify(it)));
                    onChange(next);
                    setOpen(i + 1);
                  }}
                >
                  <Icon name="copy" />
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => {
                    onChange(items.filter((_, k) => k !== i));
                    setOpen(null);
                  }}
                >
                  <Icon name="close" />
                </button>
              </span>
            </div>
            {open === i ? (
              <div className="bbfa-item__body">
                {fields.map((f) => (
                  <ControlField key={f.key} control={f} settings={it} set={(k, val) => patch(i, k, val)} ctx={ctx} />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="bbfa-inline">
        <button
          type="button"
          className="bbfa-mini"
          disabled={items.length >= max}
          onClick={() => {
            onChange([...items, blankItem(fields)]);
            setOpen(items.length);
          }}
        >
          <Icon name="plus" /> Add item
        </button>
        {c.help ? <small>{c.help}</small> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function OptionsControl({ label, options, onChange }: { label: string; options: string[]; onChange: (o: string[]) => void }) {
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

export function ImageControl({ label, value, uploadUrl, onChange }: { label: string; value: ImageValue; uploadUrl: string; onChange: (v: ImageValue) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(uploadUrl, { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { url?: string; width?: number; height?: number; variants?: { w: number; url: string }[]; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      onChange({ id: 0, url: json.url, width: json.width, height: json.height, variants: json.variants });
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
      {value.width && value.height ? (
        <small>
          {value.width} × {value.height}px{value.variants?.length ? ` · ${value.variants.length + 1} sizes` : ""}
        </small>
      ) : null}
    </div>
  );
}
