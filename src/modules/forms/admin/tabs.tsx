"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FormTabs({ formId, count, tabs }: { formId: number; count: number; tabs: { key: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="bbfa-tabs">
      <Link className="bbfa-back" href="/admin/forms">
        ← All forms
      </Link>
      {tabs.map((t) => (
        <Link key={t.key} href={`/admin/forms/${formId}/${t.key}`} className={path.endsWith(`/${t.key}`) ? "is-active" : ""}>
          {t.label}
          {t.key === "responses" ? <span className="bbfa-count">{count.toLocaleString("en-US")}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
