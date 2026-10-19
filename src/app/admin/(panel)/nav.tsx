"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ showUsers, showSettings }: { showUsers: boolean; showSettings: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/admin/forms", label: "Forms", match: (p: string) => p.startsWith("/admin/forms") && !p.startsWith("/admin/forms/settings") },
    ...(showSettings ? [{ href: "/admin/forms/settings", label: "Forms settings", match: (p: string) => p.startsWith("/admin/forms/settings") }] : []),
    ...(showUsers ? [{ href: "/admin/users", label: "Users", match: (p: string) => p.startsWith("/admin/users") }] : []),
  ];
  return (
    <>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.match(path) ? "is-active" : ""}>
          {i.label}
        </Link>
      ))}
    </>
  );
}
