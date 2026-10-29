"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SORT_HELP, SORT_LABELS, SORTS, type Sort } from "../lib/constants";
import { t } from "../strings";

export type Tab = { key: string; label: string; href: string };

/** The "All" tab and one tab per published category. */
export function CategoryTabs({ tabs, active }: { tabs: Tab[]; active: string }) {
  if (tabs.length < 2) return null;
  return (
    <nav className="cm-cats" aria-label={t.tabs.categories}>
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className="cm-cats__tab" aria-current={tab.key === active ? "page" : undefined} scroll={false}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Sort menu: Default, New, Top, Unread. The choice lives in the address (?sort=), so it can be shared. */
export function SortMenu({ base, current, appliedRule }: { base: string; current: Sort; appliedRule: Sort }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const join = (sort: Sort) => `${base}${base.includes("?") ? "&" : "?"}sort=${sort}`;
  return (
    <div className="cm-sort" ref={root}>
      <button type="button" className="cm-sort__btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
        <span>{t.tabs.sort}: {SORT_LABELS[current]}</span>
      </button>
      {open ? (
        <ul className="cm-sort__list" role="menu">
          {SORTS.map((s) => (
            <li key={s} role="none">
              <Link role="menuitem" href={s === appliedRule && current === appliedRule ? base : join(s)} className={s === current ? "is-on" : undefined} onClick={() => setOpen(false)} scroll={false}>
                <strong>{SORT_LABELS[s]}</strong>
                <span>{SORT_HELP[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
