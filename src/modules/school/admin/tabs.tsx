"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/modules/landing/admin/landing-admin.css";
import "./school-admin.css";

/** Tabs of the School library. The list is built on the server from the viewer's permissions. */
export function LibraryTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="bbfa-tabs">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href || (t.href !== "/admin/school" && path.startsWith(`${t.href}/`)) ? "is-active" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Tabs of one course. "View live" opens the public course page in its own tab. */
export function CourseTabs({ courseId, slug, live, tabs }: { courseId: number; slug: string; live: boolean; tabs: { key: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="bbfa-tabs">
      <Link className="bbfa-back" href="/admin/school">
        ← All courses
      </Link>
      {tabs.map((t) => (
        <Link key={t.key} href={`/admin/school/${courseId}/${t.key}`} className={path.endsWith(`/${t.key}`) ? "is-active" : ""}>
          {t.label}
        </Link>
      ))}
      <a className="bbp-present-tab" href={`/admin/preview/school/${slug}`} target="_blank" rel="noopener noreferrer" title="The saved course in the real player, drafts included">
        Preview ↗
      </a>
      {live ? (
        <a className="bbp-present-tab" style={{ marginLeft: 8 }} href={`/school/${slug}`} target="_blank" rel="noopener noreferrer">
          View live ↗
        </a>
      ) : null}
    </nav>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = { active: "Active", draft: "Draft", inactive: "Inactive", archived: "Archived", pending: "Awaiting payment", revoked: "Removed" };
  return <span className={`bbfa-pill bbfa-pill--${status}`}>{label[status] ?? status}</span>;
}
