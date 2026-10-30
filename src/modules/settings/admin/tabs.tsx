"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/modules/forms/admin/admin.css";

/** Subsections of Settings. Add a tab here when Settings gets a new subsection. */
const TABS = [
  { href: "/admin/settings/menus", label: "Menus" },
  { href: "/admin/settings/email", label: "Email" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav className="bbfa-tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href || path.startsWith(`${t.href}/`) ? "is-active" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
