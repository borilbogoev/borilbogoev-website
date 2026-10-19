"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Tab = { id: string; label: ReactNode };

/**
 * Accessible tabs over server-rendered panels. Every panel is in the HTML, so search engines read all
 * of it and, with JavaScript off, every panel shows (see globals.css). `variant` picks the look:
 * "underline" for the experience tabs, "pill" for the skill groups.
 */
export function Tabs({
  label,
  tabs,
  panels,
  variant = "underline",
}: {
  label: string;
  tabs: Tab[];
  panels: ReactNode[];
  variant?: "underline" | "pill";
}) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);

  const select = (index: number, focus = false) => {
    setActive(index);
    const el = buttons.current[index];
    if (focus) el?.focus();
    // Centre the tab inside its own strip. Never scrollIntoView: it would also scroll the page.
    const strip = list.current;
    if (el && strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    }
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  const listClass =
    variant === "underline"
      ? "flex overflow-x-auto border-b-2 border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-5 px-5 sm:mx-0 sm:px-0"
      : "flex flex-wrap gap-2.5";

  return (
    <div>
      <div ref={list} role="tablist" aria-label={label} className={`${listClass} mb-8`}>
        {tabs.map((tab, i) => {
          const on = i === active;
          const cls =
            variant === "underline"
              ? `-mb-0.5 min-h-[48px] shrink-0 whitespace-nowrap border-b-2 bg-transparent px-5 text-[13px] font-semibold transition-colors ${on ? "border-brand text-brand-text" : "border-transparent text-muted hover:text-ink"}`
              : `min-h-[44px] rounded-full border-[1.5px] px-5 text-[13px] font-semibold transition-colors ${on ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-muted hover:border-ink hover:text-ink"}`;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={on}
              aria-controls={`${tab.id}-panel`}
              tabIndex={on ? 0 : -1}
              className={cls}
              onClick={() => select(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {panels.map((panel, i) => (
        <div key={tabs[i].id} role="tabpanel" id={`${tabs[i].id}-panel`} aria-labelledby={`${tabs[i].id}-tab`} hidden={i !== active} tabIndex={0}>
          {panel}
        </div>
      ))}
    </div>
  );
}
