"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { SessionCard } from "@/components/session-card";
import { isInput, logicVisible, type Block, type Settings } from "../lib/blocks";
import { renderMarkdown } from "../lib/markdown";
import type { PublicForm } from "../lib/public-types";
import "./forms.css";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Value = string | string[];
type Values = Record<string, Value>;
type Page = { blocks: Block[]; next: string };

const isQuestionInput = (b: Block) => isInput(b.type) && b.type !== "hidden";

/** Splits blocks into pages: by Page Break in classic mode, one question per page in conversational mode. */
export function paginate(blocks: Block[], mode: "classic" | "conversational"): Page[] {
  if (mode === "conversational") {
    const pages: Page[] = [{ blocks: [], next: "" }];
    for (const b of blocks) {
      if (b.type === "page_break") continue;
      pages[pages.length - 1].blocks.push(b);
      if (isQuestionInput(b)) pages.push({ blocks: [], next: "" });
    }
    // A trailing page with only content joins the last question page.
    const last = pages[pages.length - 1];
    if (pages.length > 1 && !last.blocks.some(isQuestionInput)) {
      pages.pop();
      pages[pages.length - 1].blocks.push(...last.blocks);
    }
    return pages;
  }
  const pages: Page[] = [{ blocks: [], next: "" }];
  for (const b of blocks) {
    if (b.type === "page_break") {
      pages[pages.length - 1].next = String(b.settings.next_label ?? "");
      if (pages[pages.length - 1].blocks.length) pages.push({ blocks: [], next: "" });
      continue;
    }
    pages[pages.length - 1].blocks.push(b);
  }
  if (pages.length > 1 && !pages[pages.length - 1].blocks.length) pages.pop();
  return pages;
}

function rgb(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6) return "214,43,43";
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

function shuffled<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function ordered(opts: string[], order: string): string[] {
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  if (order === "alpha") return [...opts].sort(collator.compare);
  if (order === "alpha_desc") return [...opts].sort(collator.compare).reverse();
  return opts;
}

function storage(key: string, value?: string): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
  } catch {
    // storage can be blocked
  }
  return null;
}

const asList = (v: Value | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

/** Values of the blocks that are currently visible, in order (a hidden block never feeds another block's logic). */
function visibleValues(blocks: Block[], values: Values): { visible: Set<number>; values: Values } {
  const visible = new Set<number>();
  const out: Values = {};
  for (const b of blocks) {
    const ok = logicVisible(b.settings.logic, out as Record<string, string | string[]>);
    if (!ok) continue;
    visible.add(b.id);
    if (b.type === "contact") {
      for (const cf of Object.values((b.settings.fields ?? {}) as Record<string, { enabled: number; key: string }>)) if (cf.enabled) out[cf.key] = values[cf.key] ?? "";
    } else if (b.fieldKey) {
      out[b.fieldKey] = values[b.fieldKey] ?? (b.type === "choice" && b.settings.multiple ? [] : "");
    }
  }
  return { visible, values: out };
}

const MD = (text: string) => ({ __html: renderMarkdown(text) });

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

type Props = { form: PublicForm; onSubmitted?: (formId: number) => void };

export function FormRenderer({ form, onSubmitted }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);
  const hpRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<() => void>(() => {});
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const pages = useMemo(() => paginate(form.blocks, form.mode), [form.blocks, form.mode]);
  // Hidden fields start with their default value, or the URL parameter they are filled from. This component only renders in the browser.
  const [values, setValues] = useState<Values>(() => {
    const params = new URLSearchParams(window.location.search);
    const init: Values = {};
    for (const b of form.blocks) if (b.type === "hidden" && b.fieldKey) init[b.fieldKey] = (b.settings.param && params.get(b.settings.param)) || b.settings.default || "";
    return init;
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState("");
  const [done, setDone] = useState<string | null>(null);

  // Option order is decided once per visitor (random order must not change while they answer).
  const optionOrder = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const b of form.blocks) {
      if (b.type === "choice" || b.type === "dropdown") {
        const opts: string[] = b.settings.options ?? [];
        map[b.id] = b.settings.order === "random" ? shuffled(opts) : ordered(opts, b.settings.order);
      }
    }
    return map;
  }, [form.blocks]);

  // View counter, once per browser session.
  useEffect(() => {
    if (!form.track || storage(`bbf_v_${form.id}`)) return;
    storage(`bbf_v_${form.id}`, "1");
    const fd = new FormData();
    fd.append("type", "view");
    fetch(`/api/forms/${form.id}/track`, { method: "POST", body: fd }).catch(() => {});
  }, [form.id, form.track]);

  const onFirstTouch = useCallback(() => {
    if (startedAt.current) return;
    startedAt.current = Date.now();
    if (!form.track || storage(`bbf_s_${form.id}`)) return;
    storage(`bbf_s_${form.id}`, "1");
    const fd = new FormData();
    fd.append("type", "start");
    fetch(`/api/forms/${form.id}/track`, { method: "POST", body: fd }).catch(() => {});
  }, [form.id, form.track]);

  const { visible, values: liveValues } = useMemo(() => visibleValues(form.blocks, values), [form.blocks, values]);

  // Question numbers (conversational mode): every labelled input counts, in form order.
  const numbering = useMemo(() => {
    const map: Record<number, number> = {};
    let n = 0;
    for (const b of form.blocks) if (isInput(b.type) && b.type !== "hidden" && b.type !== "consent") map[b.id] = ++n;
    return map;
  }, [form.blocks]);

  const pageVisible = useCallback((i: number) => pages[i].blocks.some((b) => b.type === "spacer" || (b.type !== "hidden" && visible.has(b.id))), [pages, visible]);
  const lastVisible = useMemo(() => {
    for (let i = pages.length - 1; i >= 0; i--) if (pageVisible(i)) return i;
    return 0;
  }, [pages, pageVisible]);
  const firstVisible = useMemo(() => {
    for (let i = 0; i < page; i++) if (pageVisible(i)) return false;
    return true;
  }, [page, pageVisible]);
  const [vIndex, vTotal] = useMemo(() => {
    let n = 0;
    let total = 0;
    for (let i = 0; i < pages.length; i++) {
      if (pageVisible(i)) {
        total++;
        if (i <= page) n++;
      }
    }
    return [n, total];
  }, [pages, page, pageVisible]);

  const setValue = (key: string, v: Value) => {
    onFirstTouch();
    setValues((prev) => ({ ...prev, [key]: v }));
    setErrors((e) => {
      if (!e[key]) return e;
      const rest = { ...e };
      delete rest[key];
      return rest;
    });
  };

  /* ---------- validation ---------- */

  const validateBlock = (b: Block): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!visible.has(b.id)) return out;
    const s = b.settings;
    const req = form.labels.required;
    if (b.type === "contact") {
      for (const [sub, cf] of Object.entries((s.fields ?? {}) as Record<string, { enabled: number; required: number; key: string }>)) {
        if (!cf.enabled) continue;
        const v = String(values[cf.key] ?? "").trim();
        if (cf.required && !v) out[cf.key] = req;
        else if (v && sub === "email" && !EMAIL.test(v)) out[cf.key] = "Please enter a valid email address.";
      }
      return out;
    }
    if (!b.fieldKey || !isInput(b.type) || b.type === "hidden") return out;
    const k = b.fieldKey;
    const raw = values[k];
    let v: Value = raw ?? "";
    if (b.type === "choice") {
      v = asList(raw).map((x) => (x === "__other" ? String(values[`${k}__other`] ?? "").trim() : x)).filter(Boolean);
      if (!s.multiple) v = v[0] ?? "";
    } else if (typeof v === "string") v = v.trim();
    if (b.type === "file") v = files[k] ? files[k]!.name : "";
    const empty = Array.isArray(v) ? v.length === 0 : v === "" || (b.type === "consent" && v !== "Yes");
    if (s.required && empty) {
      out[k] = req;
      return out;
    }
    if (empty) return out;
    const text = Array.isArray(v) ? "" : v;
    if (b.type === "email" && !EMAIL.test(text)) out[k] = "Please enter a valid email address.";
    if (b.type === "number") {
      const n = parseFloat(text.replace(",", "."));
      if (Number.isNaN(n)) out[k] = "Please enter a valid number.";
      else if (s.min !== "" && n < parseFloat(s.min)) out[k] = `Please enter a valid number. (min ${s.min})`;
      else if (s.max !== "" && n > parseFloat(s.max)) out[k] = `Please enter a valid number. (max ${s.max})`;
    }
    if (b.type === "choice" && Array.isArray(v)) {
      if (s.min_select > 0 && v.length < s.min_select) out[k] = `Please select at least ${s.min_select} options.`;
      if (s.max_select > 0 && v.length > s.max_select) out[k] = `Please select up to ${s.max_select} options.`;
    }
    if (b.type === "file" && files[k] && s.max_mb && files[k]!.size > s.max_mb * 1048576) out[k] = `Max ${s.max_mb} MB`;
    return out;
  };

  const validatePage = (i: number): boolean => {
    const found: Record<string, string> = {};
    for (const b of pages[i].blocks) Object.assign(found, validateBlock(b));
    setErrors((e) => {
      const next = { ...e };
      for (const b of pages[i].blocks) {
        if (b.type === "contact") for (const cf of Object.values((b.settings.fields ?? {}) as Record<string, { key: string }>)) delete next[cf.key];
        else if (b.fieldKey) delete next[b.fieldKey];
      }
      return { ...next, ...found };
    });
    const keys = Object.keys(found);
    if (keys.length) {
      requestAnimationFrame(() => {
        const el = rootRef.current?.querySelector(`[data-key="${keys[0]}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        (el?.closest(".bbf-block")?.querySelector("input:not([type=hidden]), select, textarea") as HTMLElement | null)?.focus({ preventScroll: true });
      });
    }
    return keys.length === 0;
  };

  /* ---------- navigation ---------- */

  const go = (to: number, d: 1 | -1) => {
    setDir(d);
    setPage(to);
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.6) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (form.mode === "conversational") {
      setTimeout(() => {
        const el = rootRef.current?.querySelector<HTMLElement>(".bbf-page:not([hidden]) .bbf-block:not([hidden]) :is(input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea, select)");
        el?.focus({ preventScroll: true });
      }, 250);
    }
  };

  const next = () => {
    if (!validatePage(page)) return;
    for (let i = page + 1; i < pages.length; i++) {
      if (pageVisible(i)) {
        go(i, 1);
        return;
      }
    }
  };
  useEffect(() => {
    nextRef.current = next;
  });
  const prev = () => {
    for (let i = page - 1; i >= 0; i--) {
      if (pageVisible(i)) {
        go(i, -1);
        return;
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const t = e.target as HTMLElement;
    if (t.tagName === "TEXTAREA" && !(e.metaKey || e.ctrlKey)) return;
    if (t.tagName === "BUTTON" || t.tagName === "A") return;
    e.preventDefault();
    if (page < lastVisible) next();
    else void submit();
  };

  /* ---------- submit ---------- */

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    for (let i = 0; i < pages.length; i++) {
      if (pageVisible(i) && !validatePage(i)) {
        if (i !== page) go(i, -1);
        return;
      }
    }
    setAlert("");
    const fd = new FormData();
    fd.append("_hp", hpRef.current?.value ?? "");
    fd.append("_t", form.token);
    fd.append("_elapsed", String(startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0));
    const params = new URLSearchParams(window.location.search);
    const meta: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) if (params.get(k)) meta[k] = params.get(k)!;
    meta.referrer = document.referrer || "";
    meta.page_url = window.location.href.split("#")[0];
    meta.page_title = document.title;
    meta.lang = navigator.language || "";
    meta.screen = `${window.innerWidth}x${window.innerHeight}`;
    fd.append("_meta", JSON.stringify(meta));
    // Only visible blocks send their values.
    for (const [k, v] of Object.entries(liveValues)) for (const one of asList(v)) fd.append(`a.${k}`, one);
    for (const b of form.blocks) {
      if (b.type === "choice" && visible.has(b.id) && b.fieldKey && asList(values[b.fieldKey]).includes("__other")) fd.append(`a.${b.fieldKey}__other`, String(values[`${b.fieldKey}__other`] ?? ""));
      if (b.type === "file" && visible.has(b.id) && b.fieldKey && files[b.fieldKey]) fd.append(`f.${b.fieldKey}`, files[b.fieldKey]!);
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/submit`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; errors?: Record<string, string>; message?: string; redirect?: string };
      setBusy(false);
      if (res.status === 422 && body.errors) {
        setErrors(body.errors);
        let firstPage: number | null = null;
        pages.forEach((p, pi) => {
          if (p.blocks.some((b) => (b.type === "contact" ? Object.values((b.settings.fields ?? {}) as Record<string, { key: string }>).some((cf) => body.errors![cf.key]) : b.fieldKey && body.errors![b.fieldKey]))) firstPage = firstPage === null ? pi : Math.min(firstPage, pi);
        });
        if (firstPage !== null && firstPage !== page) go(firstPage, -1);
        setAlert("Please check the highlighted fields.");
        return;
      }
      if (!body.ok) {
        setAlert(body.message || "Something went wrong. Please try again.");
        return;
      }
      if (form.oneOnly) document.cookie = `bbf_done_${form.id}=1; path=/; max-age=31536000; SameSite=Lax`;
      if (body.redirect) {
        window.location.href = body.redirect;
        return;
      }
      setDone(body.message ?? "");
      onSubmitted?.(form.id);
      requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(".bbf-done")?.focus());
      if ((rootRef.current?.getBoundingClientRect().top ?? 0) < 0) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setBusy(false);
      setAlert("Something went wrong. Please try again.");
    }
  };

  /* ---------- field renderers ---------- */

  const err = (k: string) => errors[k] ?? "";

  const label = (b: Block, id: string, tag: "label" | "div" = "label") => {
    const s = b.settings;
    const Tag = tag;
    return (
      <>
        <Tag className="bbf-q" {...(tag === "label" ? { htmlFor: id } : { id: `${id}-label` })}>
          {form.mode === "conversational" && numbering[b.id] ? (
            <span className="bbf-qnum">
              {numbering[b.id]} <span aria-hidden="true">&rarr;</span>
            </span>
          ) : null}
          <span className="bbf-qtext">{s.question}</span>
          {s.required ? (
            <span className="bbf-req" aria-hidden="true">
              *
            </span>
          ) : null}
        </Tag>
        {s.description ? <div className="bbf-desc" dangerouslySetInnerHTML={MD(s.description)} /> : null}
      </>
    );
  };

  const wrap = (b: Block, children: ReactNode, key?: string, extraClass = "") => {
    const hidden = !visible.has(b.id);
    const k = key ?? b.fieldKey;
    return (
      <div
        key={b.id}
        className={`bbf-block bbf-block--${b.type.replace("_", "-")}${extraClass}${k && err(k) ? " has-error" : ""}${hidden ? " is-hidden-logic" : ""}`}
        data-type={b.type}
        data-key={k || undefined}
        hidden={hidden}
      >
        {children}
      </div>
    );
  };

  const errorBox = (k: string) => (
    <div className="bbf-error" role="alert">
      {err(k)}
    </div>
  );

  const renderBlock = (b: Block): ReactNode => {
    const s: Settings = b.settings;
    const k = b.fieldKey;
    const id = `bbf-${form.id}-${k || `b${b.id}`}`;
    const align = s.align ? ` bbf-align-${s.align}` : "";
    const val = values[k];
    const text = typeof val === "string" ? val : "";

    switch (b.type) {
      case "heading": {
        const Lvl = (["h1", "h2", "h3", "h4"].includes(s.level) ? s.level : "h2") as "h1" | "h2" | "h3" | "h4";
        return wrap(
          b,
          <>
            {s.eyebrow ? <div className="bbf-eyebrow">{s.eyebrow}</div> : null}
            <Lvl className={`bbf-title bbf-title--${Lvl}`}>
              {s.text}
              {s.accent_dot ? <span className="bbf-dot">.</span> : null}
            </Lvl>
          </>,
          "",
          align,
        );
      }
      case "text":
        return <div key={b.id} className={`bbf-block bbf-block--text${align} bbf-md bbf-size-${s.size}`} data-type="text" hidden={!visible.has(b.id)} dangerouslySetInnerHTML={MD(s.content)} />;
      case "image": {
        const url: string = s.image?.url ?? "";
        if (!url) return null;
        const img = <img src={url} alt={s.alt} loading="lazy" decoding="async" style={{ width: `${Number(s.width)}%` }} className={s.rounded ? "is-rounded" : undefined} />;
        return (
          <figure key={b.id} className={`bbf-block bbf-block--image${align}`} hidden={!visible.has(b.id)}>
            {s.link ? (
              <a href={s.link} target="_blank" rel="noopener noreferrer">
                {img}
              </a>
            ) : (
              img
            )}
            {s.caption ? <figcaption>{s.caption}</figcaption> : null}
          </figure>
        );
      }
      case "session":
        return (
          <div key={b.id} className="bbf-block bbf-block--session" hidden={!visible.has(b.id)}>
            <SessionCard data={s} />
          </div>
        );
      case "divider": {
        const sp = Number(s.spacing);
        if (s.style === "dots") {
          return (
            <div key={b.id} className={`bbf-block bbf-block--divider bbf-divider--dots`} style={{ margin: `${sp}px 0`, color: s.color }} role="separator" hidden={!visible.has(b.id)}>
              <span />
              <span />
              <span />
            </div>
          );
        }
        if (s.style === "accent") {
          return (
            <div key={b.id} className="bbf-block bbf-block--divider" style={{ margin: `${sp}px 0` }} role="separator" hidden={!visible.has(b.id)}>
              <hr className="bbf-divider-accent" style={{ height: Math.max(3, Number(s.thickness)) }} />
            </div>
          );
        }
        const style: CSSProperties = { border: 0, borderTop: `${s.style === "double" ? Math.max(3, Number(s.thickness) * 3) : Number(s.thickness)}px ${s.style} ${s.color}`, width: `${Number(s.width)}%`, margin: "0 auto" };
        return (
          <div key={b.id} className="bbf-block bbf-block--divider" style={{ margin: `${sp}px 0` }} role="separator" hidden={!visible.has(b.id)}>
            <hr style={style} />
          </div>
        );
      }
      case "spacer":
        return <div key={b.id} className="bbf-spacer" style={{ height: Number(s.height) }} aria-hidden="true" />;
      case "hidden":
        return null;
      case "short_text":
      case "email":
      case "phone":
      case "number":
      case "website":
      case "date": {
        const types: Record<string, string> = { short_text: "text", email: "email", phone: "tel", number: "number", website: "url", date: "date" };
        const auto: Record<string, string> = { email: "email", phone: "tel", website: "url" };
        const today = new Date().toISOString().slice(0, 10);
        const input = (
          <input
            className="bbf-input"
            type={types[b.type]}
            id={id}
            name={k}
            value={text}
            placeholder={s.placeholder || undefined}
            required={!!s.required}
            aria-required={s.required ? true : undefined}
            maxLength={b.type === "short_text" && s.max_length > 0 ? s.max_length : undefined}
            autoComplete={auto[b.type]}
            {...(b.type === "number" ? { min: s.min !== "" ? s.min : undefined, max: s.max !== "" ? s.max : undefined, step: s.step || "any", inputMode: "decimal" as const } : {})}
            {...(b.type === "date" ? { min: s.min === "today" ? today : s.min || undefined, max: s.max === "today" ? today : s.max || undefined } : {})}
            onChange={(e) => setValue(k, e.target.value)}
          />
        );
        return wrap(
          b,
          <>
            {label(b, id)}
            {b.type === "number" && s.unit ? (
              <div className="bbf-unit-wrap">
                {input}
                <span className="bbf-unit">{s.unit}</span>
              </div>
            ) : (
              input
            )}
            {errorBox(k)}
          </>,
        );
      }
      case "long_text":
        return wrap(
          b,
          <>
            {label(b, id)}
            <textarea
              className="bbf-input"
              id={id}
              name={k}
              rows={Number(s.rows)}
              value={text}
              placeholder={s.placeholder || undefined}
              required={!!s.required}
              maxLength={s.max_length > 0 ? s.max_length : undefined}
              onChange={(e) => setValue(k, e.target.value)}
            />
            {s.max_length > 0 ? (
              <div className="bbf-counter">
                <span>{text.length}</span> / {s.max_length}
              </div>
            ) : null}
            {errorBox(k)}
          </>,
        );
      case "dropdown":
        return wrap(
          b,
          <>
            {label(b, id)}
            <div className="bbf-select">
              <select className="bbf-input" id={id} name={k} value={text} required={!!s.required} onChange={(e) => setValue(k, e.target.value)}>
                <option value="">{s.placeholder || "..."}</option>
                {(optionOrder[b.id] ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {errorBox(k)}
          </>,
        );
      case "choice":
      case "yes_no": {
        const multi = b.type === "choice" && !!s.multiple;
        const opts: string[] = b.type === "yes_no" ? [s.yes_label, s.no_label] : (optionOrder[b.id] ?? []);
        const layout = b.type === "yes_no" ? "grid" : s.layout;
        const picked = asList(val);
        const max = multi ? Number(s.max_select) : 0;
        const toggle = (o: string, checked: boolean) => {
          if (multi) setValue(k, checked ? [...picked, o] : picked.filter((x) => x !== o));
          else {
            setValue(k, o);
            // Conversational: a single choice moves on by itself.
            if (form.mode === "conversational" && o !== "__other") {
              const inputs = pages[page].blocks.filter((x) => isQuestionInput(x) && visible.has(x.id));
              if (inputs.length === 1 && page < lastVisible) {
                clearTimeout(advance.current);
                advance.current = setTimeout(() => nextRef.current(), 380);
              }
            }
          }
        };
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const choiceEl = (o: string, i: number) => {
          const checked = picked.includes(o);
          const disabled = multi && max > 0 && picked.length >= max && !checked;
          return (
            <label key={o} className={`bbf-choice${checked ? " is-checked" : ""}${disabled ? " is-disabled" : ""}`}>
              <input type={multi ? "checkbox" : "radio"} name={k} value={o} checked={checked} disabled={disabled} onChange={(e) => toggle(o, e.target.checked)} />
              <span className="bbf-choice__key">{b.type === "yes_no" ? o.charAt(0).toUpperCase() : (letters[i] ?? i + 1)}</span>
              <span className="bbf-choice__label">{o}</span>
              <span className="bbf-choice__check" aria-hidden="true" />
            </label>
          );
        };
        const otherChecked = picked.includes("__other");
        return wrap(
          b,
          <>
            {label(b, id, "div")}
            {multi ? <div className="bbf-hint-sm">{max > 0 ? `Choose up to ${max}` : "Choose as many as you like"}</div> : null}
            <div className={`bbf-choices bbf-choices--${layout}`} role={multi ? "group" : "radiogroup"} aria-labelledby={`${id}-label`}>
              {opts.map(choiceEl)}
              {b.type === "choice" && s.allow_other ? (
                <label className={`bbf-choice bbf-choice--other${otherChecked ? " is-checked" : ""}`}>
                  <input type={multi ? "checkbox" : "radio"} name={k} value="__other" checked={otherChecked} onChange={(e) => toggle("__other", e.target.checked)} />
                  <span className="bbf-choice__key">+</span>
                  <input
                    type="text"
                    className="bbf-other"
                    placeholder="Other..."
                    value={String(values[`${k}__other`] ?? "")}
                    onFocus={() => !otherChecked && toggle("__other", true)}
                    onChange={(e) => setValue(`${k}__other`, e.target.value)}
                  />
                  <span className="bbf-choice__check" aria-hidden="true" />
                </label>
              ) : null}
            </div>
            {errorBox(k)}
          </>,
        );
      }
      case "rating": {
        const n = Number(s.max);
        const current = Number(text) || 0;
        const icons: Record<string, ReactNode> = {
          star: <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z" />,
          heart: <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />,
          circle: <circle cx="12" cy="12" r="9" />,
        };
        return wrap(
          b,
          <>
            {label(b, id, "div")}
            <HoverRating n={n} current={current} onPick={(i) => setValue(k, String(i))} name={k} icon={icons[s.shape] ?? icons.star} labelledBy={`${id}-label`} />
            {errorBox(k)}
          </>,
        );
      }
      case "scale": {
        const min = Number(s.min);
        const max = Number(s.max);
        const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return wrap(
          b,
          <>
            {label(b, id, "div")}
            <div className="bbf-scale" role="radiogroup" aria-labelledby={`${id}-label`} style={{ "--n": items.length } as CSSProperties}>
              {items.map((i) => (
                <label key={i} className={`bbf-scale__item${text === String(i) ? " is-checked" : ""}`}>
                  <input type="radio" name={k} value={i} checked={text === String(i)} onChange={() => setValue(k, String(i))} />
                  <span>{i}</span>
                </label>
              ))}
            </div>
            <div className="bbf-scale__labels">
              <span>{s.left_label}</span>
              <span>{s.right_label}</span>
            </div>
            {errorBox(k)}
          </>,
        );
      }
      case "consent":
        return wrap(
          b,
          <>
            <label className="bbf-consent">
              <input type="checkbox" name={k} value="Yes" checked={text === "Yes"} required={!!s.required} aria-required={s.required ? true : undefined} onChange={(e) => setValue(k, e.target.checked ? "Yes" : "No")} />
              <span className="bbf-consent__box" aria-hidden="true" />
              <span className="bbf-consent__text">
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(s.text).replace(/<\/?p>/g, "") }} />
                {s.required ? <span className="bbf-req"> *</span> : null}
              </span>
            </label>
            {errorBox(k)}
          </>,
        );
      case "file": {
        const f = files[k];
        const types = String(s.types ?? "")
          .split(",")
          .filter(Boolean);
        return wrap(
          b,
          <>
            {label(b, id)}
            <label className={`bbf-file${f ? " has-file" : ""}`}>
              <input
                type="file"
                id={id}
                name={k}
                accept={types.map((t) => `.${t.trim()}`).join(",")}
                required={!!s.required && !f}
                onChange={(e) => {
                  onFirstTouch();
                  setFiles((p) => ({ ...p, [k]: e.target.files?.[0] ?? null }));
                  setErrors((p) => {
                    const rest = { ...p };
                    delete rest[k];
                    return rest;
                  });
                }}
              />
              <span className="bbf-file__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 16V4m0 0l-5 5m5-5l5 5M4 20h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="bbf-file__text">
                <b>Choose a file</b> or drag it here
                <small>
                  {types.join(", ").toUpperCase()} &middot; max {Number(s.max_mb)} MB
                </small>
              </span>
              <span className="bbf-file__name">{f?.name ?? ""}</span>
            </label>
            {errorBox(k)}
          </>,
        );
      }
      case "contact": {
        const auto: Record<string, string> = { first_name: "given-name", last_name: "family-name", email: "email", phone: "tel", company: "organization", job_title: "organization-title", website: "url", address: "street-address", city: "address-level2", zip: "postal-code", country: "country-name" };
        const entries = Object.entries((s.fields ?? {}) as Record<string, { enabled: number; required: number; label: string; key: string }>).filter(([, cf]) => cf.enabled);
        const typeOf: Record<string, string> = { email: "email", phone: "tel", website: "url" };
        return wrap(
          b,
          <>
            {label({ ...b, settings: { ...s, required: 0 } }, id, "div")}
            <div className={`bbf-contact bbf-cols-${Number(s.columns)}`}>
              {entries.map(([sub, cf]) => {
                const fid = `bbf-${form.id}-${cf.key}`;
                return (
                  <div key={sub} className={`bbf-sub${sub === "address" ? " bbf-wide" : ""}${err(cf.key) ? " has-error" : ""}`} data-key={cf.key}>
                    <label className="bbf-sublabel" htmlFor={fid}>
                      {cf.label}
                      {cf.required ? <span className="bbf-req"> *</span> : null}
                    </label>
                    <input
                      className="bbf-input"
                      type={typeOf[sub] ?? "text"}
                      id={fid}
                      name={cf.key}
                      value={String(values[cf.key] ?? "")}
                      autoComplete={auto[sub] ?? "on"}
                      required={!!cf.required}
                      aria-required={cf.required ? true : undefined}
                      onChange={(e) => setValue(cf.key, e.target.value)}
                    />
                    {errorBox(cf.key)}
                  </div>
                );
              })}
            </div>
          </>,
          "",
        );
      }
    }
    return null;
  };

  /* ---------- layout ---------- */

  const vars = {
    "--bbf-accent": form.accent,
    "--bbf-accent-rgb": rgb(form.accent),
    "--bbf-text": form.theme === "dark" ? "#F5F5F5" : form.textColor,
    "--bbf-radius": `${form.radius}px`,
    "--bbf-font": form.fontFamily === "inherit" ? "inherit" : form.fontFamily === "system" ? "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" : undefined,
    maxWidth: form.maxWidth,
  } as CSSProperties;

  if (form.state !== "open") {
    return (
      <div className={`bbf bbf--${form.mode} bbf--${form.theme}`} style={vars}>
        <div className="bbf-card bbf-closed" dangerouslySetInnerHTML={{ __html: form.notice ?? "" }} />
      </div>
    );
  }

  const isLast = page >= lastVisible;
  return (
    <div ref={rootRef} className={`bbf bbf--${form.mode} bbf--${form.theme}`} style={vars} data-bbf-form={form.id}>
      {form.draft ? <div className="bbf-draft-note">Draft: only signed-in staff can see this form.</div> : null}
      {done === null ? (
        <form className="bbf-card bbf-form" noValidate onSubmit={submit} onKeyDown={onKeyDown} onFocus={onFirstTouch}>
          {pages.length > 1 && form.progress ? (
            <div className="bbf-progress" aria-hidden="true">
              <span style={{ width: `${vTotal > 1 ? Math.round(((vIndex - 1) / (vTotal - 1)) * 100) : 100}%` }} />
            </div>
          ) : null}
          {pages.map((p, pi) => (
            <section key={pi} className={`bbf-page${pi === page ? ` is-active ${dir < 0 ? "from-left" : "from-right"}` : ""}`} hidden={pi !== page}>
              {p.blocks.map(renderBlock)}
            </section>
          ))}
          <div className="bbf-hp" aria-hidden="true">
            <label>
              Leave empty
              <input ref={hpRef} type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {alert ? (
            <div className="bbf-alert" role="alert">
              {alert}
            </div>
          ) : null}
          <div className="bbf-nav">
            <button type="button" className="bbf-btn bbf-btn--ghost bbf-prev" hidden={firstVisible} onClick={prev}>
              <span aria-hidden="true">&larr;</span> {form.labels.prev}
            </button>
            {pages.length > 1 && form.pageNumbers && vTotal > 1 ? (
              <span className="bbf-pagenum" aria-live="polite">
                <b>{vIndex}</b> / {vTotal}
              </span>
            ) : null}
            <button type="button" className="bbf-btn bbf-next" hidden={isLast} onClick={next}>
              <span className="bbf-next-label">{pages[page].next || form.labels.next}</span> <span aria-hidden="true">&rarr;</span>
            </button>
            <button type="submit" className={`bbf-btn bbf-submit${busy ? " is-loading" : ""}`} hidden={!isLast} disabled={busy}>
              <span>{form.labels.submit}</span>
            </button>
            {form.mode === "conversational" ? (
              <span className="bbf-hint">
                press <kbd>Enter &#8629;</kbd>
              </span>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="bbf-card bbf-done" tabIndex={-1}>
          <div className="bbf-done__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="bbf-md" dangerouslySetInnerHTML={{ __html: done }} />
        </div>
      )}
    </div>
  );
}

function HoverRating({ n, current, onPick, name, icon, labelledBy }: { n: number; current: number; onPick: (i: number) => void; name: string; icon: ReactNode; labelledBy: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="bbf-rating" role="radiogroup" aria-labelledby={labelledBy} onMouseLeave={() => setHover(0)}>
      {Array.from({ length: n }, (_, i) => i + 1).map((i) => (
        <label key={i} className={`bbf-rate${i <= current ? " is-on" : ""}${hover && i <= hover ? " is-hover" : ""}`} title={String(i)} onMouseEnter={() => setHover(i)}>
          <input type="radio" name={name} value={i} checked={current === i} onChange={() => onPick(i)} />
          <span className="screen-reader-text">{i}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {icon}
          </svg>
        </label>
      ))}
    </div>
  );
}
