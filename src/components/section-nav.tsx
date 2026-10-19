"use client";

import { useEffect, useRef, useState } from "react";

/** The About page submenu: a sticky strip of in-page links with the current section highlighted. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0].id);
  const strip = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A section counts as current while it crosses a band just under the sticky bars.
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  // Keep the current pill in view on phones.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  return (
    <nav aria-label="On this page" className="no-print sticky top-16 z-40 border-b border-line" style={{ background: "var(--nav-glass)", backdropFilter: "blur(12px)" }}>
      <ul ref={strip} className="container-bb m-0 flex list-none items-center gap-1 overflow-x-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-3">
        {items.map((item) => {
          const on = item.id === active;
          return (
            <li key={item.id} data-id={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={on ? "location" : undefined}
                className={`relative inline-flex min-h-[48px] items-center px-3 text-[13px] font-semibold transition-colors ${on ? "text-brand-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand" : "text-muted hover:text-ink"}`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
