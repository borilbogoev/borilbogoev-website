"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/modules/forms/admin/admin.css";
import "@/modules/landing/admin/landing-admin.css";
import "./admin.css";
import { Toaster } from "../components/toast";

/** Tabs of the control panel. */
export function CommunityTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="bbfa-tabs" aria-label="Communities admin">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={path === i.href || (i.href !== "/admin/communities" && path.startsWith(`${i.href}/`)) ? "is-active" : ""}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export const ADMIN_TABS = [
  { href: "/admin/communities", label: "Overview" },
  { href: "/admin/communities/list", label: "Communities" },
  { href: "/admin/communities/moderation", label: "Moderation" },
  { href: "/admin/communities/content", label: "Content" },
  { href: "/admin/communities/suspensions", label: "Suspensions" },
  { href: "/admin/communities/settings", label: "Settings" },
];

/** Mounts the toast area for pages that live outside the Community shell. */
export function ToastHost() {
  return <Toaster />;
}
