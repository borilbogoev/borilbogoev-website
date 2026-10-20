"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./landing-admin.css";

export function PageTabs({ pageId, tabs }: { pageId: number; tabs: { key: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="bbfa-tabs">
      <Link className="bbfa-back" href="/admin/landing">
        ← All pages
      </Link>
      {tabs.map((t) => (
        <Link key={t.key} href={`/admin/landing/${pageId}/${t.key}`} className={path.endsWith(`/${t.key}`) ? "is-active" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = { published: "Published", draft: "Draft", archived: "Archived" };
  return <span className={`bbfa-pill bbfa-pill--${status}`}>{label[status] ?? status}</span>;
}
