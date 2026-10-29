"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { t } from "../strings";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

/** A small actions menu: button, list, Escape and outside click close it, arrow keys move. */
export function Menu({ items, label = t.a11y.menu }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  if (!items.length) return null;
  const buttons = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
  return (
    <div className="cm-menu" ref={root}>
      <button
        type="button"
        className="cm-iconbtn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => buttons()[0]?.focus());
          }
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          className="cm-menu__list"
          onKeyDown={(e) => {
            const b = buttons();
            const i = b.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "Escape") {
              setOpen(false);
              (root.current?.querySelector("button") as HTMLButtonElement | null)?.focus();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              b[(i + 1) % b.length]?.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              b[(i - 1 + b.length) % b.length]?.focus();
            }
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={it.danger ? "is-danger" : undefined}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="cm-dialog" aria-label={title} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open ? (
        <div className="cm-dialog__box">
          <div className="cm-dialog__head">
            <h2>{title}</h2>
            <button type="button" className="cm-iconbtn" aria-label={t.action.close} onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
