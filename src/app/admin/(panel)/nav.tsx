"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** One link per module (plus admin-wide screens). A link is active for every page inside it. */
export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={path === i.href || path.startsWith(`${i.href}/`) ? "is-active" : ""}>
          {i.label}
        </Link>
      ))}
    </>
  );
}
