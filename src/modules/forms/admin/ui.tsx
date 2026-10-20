"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import "./admin.css";

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiOptions = { method?: string; body?: unknown; query?: Record<string, unknown> };

/** Calls /api/admin/<path> and returns the JSON. Throws ApiError with a readable message. */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  let url = `/api/admin/${path}`;
  if (opts.query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) if (v !== "" && v !== null && v !== undefined) q.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    const s = q.toString();
    if (s) url += `?${s}`;
  }
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) {
    window.location.assign(new URL(`/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, window.location.origin));
    throw new ApiError("Please sign in again.", 401);
  }
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status);
  return json as T;
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

const PATHS: Record<string, ReactNode> = {
  heading: <path d="M6 4v16M18 4v16M6 12h12" />,
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  short: (
    <>
      <path d="M4 9h16v6H4z" />
      <path d="M8 12h5" />
    </>
  ),
  long: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h4" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  number: <path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  date: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  choice: (
    <>
      <circle cx="6" cy="7" r="2" />
      <circle cx="6" cy="17" r="2" />
      <path d="M11 7h9M11 17h9" />
    </>
  ),
  dropdown: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M14 11l2 2 2-2" />
    </>
  ),
  yesno: (
    <>
      <path d="M4 12l4 4 8-8" />
      <path d="M15 15l5 5M20 15l-5 5" />
    </>
  ),
  star: <path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z" />,
  scale: <path d="M4 18V14M9 18V10M14 18V7M19 18V4" />,
  contact: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  check: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  hidden: <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 22 12a14 14 0 0 1-2.2 3.2M6.6 6.6A14 14 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />,
  divider: <path d="M3 12h18M7 7h10M7 17h10" opacity=".5" />,
  spacer: <path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" />,
  pagebreak: (
    <>
      <path d="M5 3v5h14V3M5 21v-5h14v5" />
      <path d="M3 12h3M9 12h2M14 12h2M19 12h2" />
    </>
  ),
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  grip: (
    <>
      <circle cx="9" cy="6" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="18" r="1" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  logic: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 6h8M6 8v4a6 6 0 0 0 6 6h4" />
    </>
  ),
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  inbox: (
    <>
      <path d="M3 13l3-8h12l3 8v6H3z" />
      <path d="M3 13h5l1 3h6l1-3h5" />
    </>
  ),
  /* Landing Pages blocks */
  hero: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 10h10M7 14h6" />
    </>
  ),
  heroimg: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M6 9h6M6 13h4" />
      <rect x="14" y="8" width="4" height="8" rx="1" />
    </>
  ),
  cta: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M9 12h6M13 10l2 2-2 2" />
    </>
  ),
  buttons: (
    <>
      <rect x="2" y="5" width="9" height="5" rx="2.5" />
      <rect x="13" y="5" width="9" height="5" rx="2.5" />
      <rect x="6" y="14" width="12" height="5" rx="2.5" />
    </>
  ),
  form: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </>
  ),
  quote: <path d="M7 7h4v5a4 4 0 0 1-4 4M14 7h4v5a4 4 0 0 1-4 4" />,
  numbers: <path d="M5 20V12M10 20V6M15 20v-6M20 20V9M3 20h18" />,
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="4" width="12" height="10" rx="2" />
      <path d="M18 8h3v10H9v-2" />
      <circle cx="7" cy="8" r="1.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </>
  ),
  audio: <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />,
  pricing: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 14h3M8 17h6" />
    </>
  ),
  testimonial: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  ps: <path d="M6 20V5h6a3.5 3.5 0 0 1 0 7H6M16 14.5a2.2 2.2 0 0 1 4 .2c0 2.2-4 2.4-4 4.8h4" />,
  carousel: (
    <>
      <rect x="6" y="5" width="12" height="14" rx="2" />
      <path d="M3 9v6M21 9v6" />
    </>
  ),
  faq: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01" />
    </>
  ),
  steps: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.5l8 3M16 13.5l-8 3" />
    </>
  ),
  list: <path d="M4 7l1.5 1.5L8 6M4 13l1.5 1.5L8 12M4 19l1.5 1.5L8 18M11 7h9M11 13h9M11 19h9" />,
  compare: (
    <>
      <rect x="3" y="4" width="8" height="16" rx="2" />
      <rect x="13" y="4" width="8" height="16" rx="2" />
      <path d="M6 9h2M16 9h2M16 13h2" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12M12 8c-3 0-4-1.5-3.5-3S11.5 5 12 8zM12 8c3 0 4-1.5 3.5-3S12.5 5 12 8z" />
    </>
  ),
  bio: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0M16 8h5M16 12h5" />
    </>
  ),
  logos: (
    <>
      <rect x="3" y="7" width="5" height="10" rx="1.5" />
      <rect x="9.5" y="7" width="5" height="10" rx="1.5" />
      <rect x="16" y="7" width="5" height="10" rx="1.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </>
  ),
  embed: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  features: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  pie: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </>
  ),
  cursor: <path d="M6 3l12 6-5 2-2 5z" />,
  external: <path d="M7 17L17 7M8 7h9v9" />,
};

export function Icon({ name }: { name: string }) {
  return (
    <svg className="bbfa-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.text}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Toast, copy                                                                */
/* -------------------------------------------------------------------------- */

type ToastFn = (message: string, kind?: "ok" | "error") => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ message: string; kind: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback<ToastFn>((message, kind = "ok") => {
    setT({ message, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`bbfa-toast${t ? " is-show" : ""}${t?.kind === "error" ? " is-error" : ""}`} role="status">
        {t?.message}
      </div>
    </ToastCtx.Provider>
  );
}

export function useCopy() {
  const toast = useToast();
  return useCallback(
    (text: string) => {
      const done = () => toast(`Copied: ${text.length > 60 ? `${text.slice(0, 57)}...` : text}`);
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => toast("Copy failed", "error"));
      else toast("Copy failed", "error");
    },
    [toast],
  );
}

export function CopyCode({ text, large, children }: { text: string; large?: boolean; children?: ReactNode }) {
  const copy = useCopy();
  return (
    <button type="button" className={`bbfa-code${large ? " bbfa-code--lg" : ""}`} onClick={() => copy(text)} title="Click to copy">
      {children ?? text}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal and confirm                                                          */
/* -------------------------------------------------------------------------- */

export function Modal({ children, onClose, wide, small }: { children: ReactNode; onClose: () => void; wide?: boolean; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    box.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className={`bbfa-modal${wide ? " is-wide" : ""}${open ? " is-open" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} className={`bbfa-modal__box${small ? " is-small" : ""}`} role="dialog" aria-modal="true">
        <button type="button" className="bbfa-modal__x" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div className="bbfa-modal__body">{children}</div>
      </div>
    </div>
  );
}

type ConfirmFn = (message: string, okLabel?: string) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; ok: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback<ConfirmFn>((message, ok = "Delete") => new Promise((resolve) => setState({ message, ok, resolve })), []);
  const finish = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state ? (
        <Modal small onClose={() => finish(false)}>
          <div className="bbfa-confirm">
            <div className="bbfa-confirm__icon">
              <Icon name="trash" />
            </div>
            <p>{state.message}</p>
            <div className="bbfa-confirm__actions">
              <button type="button" className="bbfa-btn bbfa-btn--ghost" onClick={() => finish(false)}>
                Cancel
              </button>
              <button type="button" className="bbfa-btn bbfa-btn--danger" onClick={() => finish(true)}>
                {state.ok}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </ConfirmCtx.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

export function Card({ id, eyebrow, title, desc, children }: { id?: string; eyebrow: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="bbfa-card" id={id}>
      <div className="bbfa-card__head">
        <div className="bbfa-eyebrow">{eyebrow}</div>
        <h3>{title}</h3>
        {desc ? <p>{desc}</p> : null}
      </div>
      <div className="bbfa-grid">{children}</div>
    </div>
  );
}

type FieldProps = { label: string; help?: ReactNode; wide?: boolean };

export function TextField({ label, help, wide, value, onChange, type = "text", placeholder, ...rest }: FieldProps & { value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; min?: number; max?: number; maxLength?: number }) {
  return (
    <label className={`bbfa-field${wide ? " bbfa-field--wide" : ""}`}>
      <span className="bbfa-label">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...rest} />
      {help ? <small>{help}</small> : null}
    </label>
  );
}

export function TextArea({ label, help, value, onChange, rows = 4 }: FieldProps & { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="bbfa-field bbfa-field--wide">
      <span className="bbfa-label">{label}</span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {help ? <small>{help}</small> : null}
    </label>
  );
}

export function SelectField({ label, help, wide, value, onChange, choices }: FieldProps & { value: string; onChange: (v: string) => void; choices: Record<string, string> }) {
  return (
    <label className={`bbfa-field${wide ? " bbfa-field--wide" : ""}`}>
      <span className="bbfa-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(choices).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      {help ? <small>{help}</small> : null}
    </label>
  );
}

export function Toggle({ label, help, checked, onChange, small }: { label: ReactNode; help?: ReactNode; checked: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  return (
    <label className={`bbfa-toggle${small ? " is-sm" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="bbfa-toggle__ui" />
      <span>
        <span className="bbfa-label">{label}</span>
        {help ? <small>{help}</small> : null}
      </span>
    </label>
  );
}

export function ColorField({ label, help, value, onChange, fallback = "#D62B2B" }: FieldProps & { value: string; onChange: (v: string) => void; fallback?: string }) {
  return (
    <label className="bbfa-field">
      <span className="bbfa-label">{label}</span>
      <span className="bbfa-color">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : fallback} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input type="text" value={value} placeholder="Default" maxLength={7} onChange={(e) => onChange(e.target.value)} />
      </span>
      {help ? <small>{help}</small> : null}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

const TzCtx = createContext("UTC");
export const TimeZoneProvider = TzCtx.Provider;
export const useTimeZone = () => useContext(TzCtx);

export function useFormatters() {
  const tz = useTimeZone();
  return useMemo(() => {
    const parts = (d: Date) =>
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(d)
        .reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {});
    return {
      dateTime: (iso: string) => {
        if (!iso) return "";
        const p = parts(new Date(iso));
        return `${p.month} ${p.day}, ${p.year} · ${p.hour}:${p.minute}`;
      },
      date: (iso: string) => {
        const p = parts(new Date(iso));
        return `${p.month} ${p.day}, ${p.year}`;
      },
      time: (iso: string) => {
        const p = parts(new Date(iso));
        return `${p.hour}:${p.minute}`;
      },
      /** Value for <input type="datetime-local"> in the forms time zone. */
      local: (iso: string) => {
        const f = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
        return f.replace(" ", "T");
      },
      today: () => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()),
      ago: (iso: string) => {
        const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
        if (s < 60) return "just now";
        const units: [number, string][] = [
          [60, "min"],
          [3600, "hour"],
          [86400, "day"],
          [2592000, "month"],
        ];
        let label = "year";
        let n = Math.round(s / 31536000);
        for (let i = units.length - 1; i >= 0; i--) {
          if (s >= units[i][0]) {
            n = Math.round(s / units[i][0]);
            label = units[i][1];
            break;
          }
        }
        return `${n} ${label}${n === 1 ? "" : "s"} ago`;
      },
    };
  }, [tz]);
}

export function fmtDuration(sec: number): string {
  if (!sec) return "–";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s ? `${s}s` : ""}`.trim();
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export const fmtNum = (n: number | string | null | undefined) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Local date helpers for the range picker (YYYY-MM-DD strings). */
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function presetRange(p: string, today: string): { from: string; to: string } {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  const from = new Date(t);
  let to = new Date(t);
  switch (p) {
    case "today":
      break;
    case "7":
      from.setDate(t.getDate() - 6);
      break;
    case "30":
      from.setDate(t.getDate() - 29);
      break;
    case "90":
      from.setDate(t.getDate() - 89);
      break;
    case "month":
      from.setDate(1);
      break;
    case "lastmonth":
      from.setMonth(t.getMonth() - 1, 1);
      to = new Date(t.getFullYear(), t.getMonth(), 0);
      break;
    case "year":
      from.setMonth(0, 1);
      break;
    case "all":
      return { from: "", to: "" };
  }
  return { from: ymd(from), to: ymd(to) };
}

export type Range = { preset: string; from: string; to: string };

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const f = useFormatters();
  const presets: [string, string][] = [["today", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"], ["all", "All time"], ["custom", "Custom range"]];
  return (
    <div className="bbfa-range">
      <span className="bbfa-range__icon">
        <Icon name="date" />
      </span>
      <select
        className="bbfa-range__preset"
        aria-label="Date range"
        value={value.preset}
        onChange={(e) => {
          const p = e.target.value;
          if (p === "custom") return onChange({ ...value, preset: p });
          onChange({ preset: p, ...presetRange(p, f.today()) });
        }}
      >
        {presets.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <input type="date" aria-label="Start date" value={value.from} onChange={(e) => onChange({ preset: "custom", from: e.target.value, to: value.to })} />
      <span className="bbfa-range__sep">→</span>
      <input type="date" aria-label="End date" value={value.to} onChange={(e) => onChange({ preset: "custom", from: value.from, to: e.target.value })} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Charts (SVG)                                                               */
/* -------------------------------------------------------------------------- */

function niceMax(v: number): number {
  if (v <= 0) return 4;
  const e = 10 ** Math.floor(Math.log10(v));
  const f = v / e;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  const m = n * e;
  return m < 4 && Number.isInteger(v) ? Math.max(4, Math.ceil(v)) : m;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Series = { name: string; data: number[]; color: string; area?: boolean; dash?: boolean };

export function LineChart({ labels, series, height = 240, fmt, labelFmt }: { labels: string[]; series: Series[]; height?: number; fmt?: (n: number) => string; labelFmt?: (l: string) => string }) {
  const [ref, width] = useWidth();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(280, width);
  const H = height;
  const pl = 40;
  const pr = 12;
  const pt = 14;
  const pb = 30;
  const n = labels.length;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.data)));
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const x = (i: number) => pl + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => pt + ih - (v / max) * ih;
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
  const f = fmt ?? ((v: number) => fmtNum(v));
  return (
    <div className="bbfa-chart" ref={ref} style={{ position: "relative" }}>
      {width > 0 ? (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`g${gid}${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity=".22" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {[0, 1, 2, 3, 4].map((g) => {
            const gv = (max / 4) * g;
            return (
              <g key={g}>
                <line x1={pl} x2={W - pr} y1={y(gv)} y2={y(gv)} className={`bbfa-gl${g === 0 ? " is-base" : ""}`} />
                <text x={pl - 8} y={y(gv) + 4} textAnchor="end" className="bbfa-axis">
                  {fmt ? fmt(gv) : gv % 1 ? gv.toFixed(1) : gv}
                </text>
              </g>
            );
          })}
          {labels.map((l, i) =>
            i % step === 0 || (i === n - 1 && n < 40) ? (
              <text key={l} x={x(i)} y={H - 8} textAnchor="middle" className="bbfa-axis">
                {labelFmt ? labelFmt(l) : l}
              </text>
            ) : null,
          )}
          {n > 0
            ? series.map((s, si) => {
                const pts = s.data.map((v, i) => [x(i), y(v)] as const);
                const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
                return (
                  <g key={si}>
                    {s.area !== false ? <path d={`${d} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)}Z`} fill={`url(#g${gid}${si})`} /> : null}
                    <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? "4 4" : undefined} />
                    {n <= 45 ? pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="#fff" stroke={s.color} strokeWidth="1.8" />) : null}
                  </g>
                );
              })
            : null}
          {hover !== null ? <line className="bbfa-cursor" x1={x(hover)} x2={x(hover)} y1={pt} y2={pt + ih} /> : null}
          <rect
            x={pl}
            y={pt}
            width={iw}
            height={ih}
            fill="transparent"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
            }}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      ) : null}
      {hover !== null && width > 0 ? (
        <div className="bbfa-tip" style={{ display: "block", position: "absolute", left: Math.min(W - 150, Math.max(0, x(hover) - 60)), top: Math.max(0, Math.min(...series.map((s) => y(s.data[hover] ?? 0))) - 64) }}>
          <b>{labelFmt ? labelFmt(labels[hover]) : labels[hover]}</b>
          {series.map((s) => (
            <div key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}: <strong>{f(s.data[hover] ?? 0)}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BarChart({ labels, data, color, soft = "rgba(17,17,17,.12)", unit, tipLabels, height = 200 }: { labels: string[]; data: number[]; color: string; soft?: string; unit?: string; tipLabels?: string[]; height?: number }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(240, width);
  const H = height;
  const pl = 34;
  const pr = 6;
  const pt = 10;
  const pb = 26;
  const n = labels.length;
  const max = niceMax(Math.max(0, ...data));
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const bw = iw / n;
  const gap = Math.min(10, bw * 0.28);
  const peak = Math.max(0, ...data);
  const skip = Math.ceil(n / Math.max(1, Math.floor(iw / 34)));
  return (
    <div className="bbfa-chart" ref={ref} style={{ position: "relative" }}>
      {width > 0 ? (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {[0, 1, 2, 3, 4].map((g) => {
            const gv = (max / 4) * g;
            const gy = pt + ih - (gv / max) * ih;
            return (
              <g key={g}>
                <line x1={pl} x2={W - pr} y1={gy} y2={gy} className={`bbfa-gl${g === 0 ? " is-base" : ""}`} />
                <text x={pl - 6} y={gy + 4} textAnchor="end" className="bbfa-axis">
                  {gv % 1 ? gv.toFixed(1) : gv}
                </text>
              </g>
            );
          })}
          {data.map((v, i) => {
            const bh = (v / max) * ih;
            const bx = pl + i * bw + gap / 2;
            return (
              <g key={i}>
                <rect className="bbfa-bar" x={bx} y={pt + ih - bh} width={Math.max(2, bw - gap)} height={Math.max(0, bh)} rx={Math.min(6, (bw - gap) / 2)} fill={v === peak && v > 0 ? color : soft} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                {i % skip === 0 ? (
                  <text x={bx + (bw - gap) / 2} y={H - 8} textAnchor="middle" className="bbfa-axis">
                    {labels[i]}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {hover !== null ? (
        <div className="bbfa-tip" style={{ display: "block", position: "absolute", left: Math.min(W - 130, Math.max(0, pl + hover * bw - 40)), top: 0 }}>
          <b>{tipLabels?.[hover] ?? labels[hover]}</b>
          <div>
            {fmtNum(data[hover])} {unit}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HBars({ items, noPct }: { items: { label: string; n: number; pct?: number }[]; noPct?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  const top = Math.max(0, ...items.map((i) => i.n));
  return (
    <div className="bbfa-hbars">
      {items.map((it) => (
        <div key={it.label} className={`bbfa-hbar${it.n === top && it.n > 0 ? " is-top" : ""}`}>
          <div className="bbfa-hbar__head">
            <span className="bbfa-hbar__label">{it.label}</span>
            <span className="bbfa-hbar__val">
              <strong>{fmtNum(it.n)}</strong>
              {noPct ? null : <em> {it.pct ?? 0}%</em>}
            </span>
          </div>
          <div className="bbfa-hbar__track">
            <div className="bbfa-hbar__fill" style={{ width: `${(it.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
