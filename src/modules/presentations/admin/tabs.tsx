"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./presentations-admin.css";

/** Tabs of one presentation. "Present" opens the full-window presenter view in its own tab, so demo tabs stay one click away. */
export function DeckTabs({ deckId, tabs }: { deckId: number; tabs: { key: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="bbfa-tabs">
      <Link className="bbfa-back" href="/admin/presentations">
        ← All presentations
      </Link>
      {tabs.map((t) => (
        <Link key={t.key} href={`/admin/presentations/${deckId}/${t.key}`} className={path.endsWith(`/${t.key}`) ? "is-active" : ""}>
          {t.label}
        </Link>
      ))}
      <a className="bbp-present-tab" href={`/admin/preview/presentations/${deckId}`} target="_blank" rel="noopener noreferrer">
        Present ↗
      </a>
    </nav>
  );
}

/** Tabs of the library: the list and the dashboard. */
export function LibraryTabs() {
  const path = usePathname();
  const items = [
    { href: "/admin/presentations", label: "Presentations" },
    { href: "/admin/presentations/dashboard", label: "Dashboard" },
  ];
  return (
    <nav className="bbfa-tabs">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "is-active" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = { active: "Active", draft: "Draft", inactive: "Inactive", archived: "Archived" };
  return <span className={`bbfa-pill bbfa-pill--${status}`}>{label[status] ?? status}</span>;
}
