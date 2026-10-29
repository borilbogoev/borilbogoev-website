"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {d}
  </svg>
);

// One list drives the menu everywhere. Add an entry here when the area grows a new page.
export const ACCOUNT_NAV: { href: string; label: string; icon: ReactNode; exact?: boolean }[] = [
  { href: "/account", label: "Home", exact: true, icon: icon(<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />) },
  { href: "/account/info", label: "My Info", icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>) },
  { href: "/account/courses", label: "My Courses", icon: icon(<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 7h6" /></>) },
  { href: "/account/responses", label: "My Responses", icon: icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>) },
];

export function AccountNav({ admin, logout }: { admin: boolean; logout: () => Promise<void> }) {
  const path = usePathname();
  const on = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="ac-nav" aria-label="My account">
      {ACCOUNT_NAV.map((i) => (
        <Link key={i.href} href={i.href} className="ac-nav__item" aria-current={on(i.href, i.exact) ? "page" : undefined}>
          {i.icon}
          {i.label}
        </Link>
      ))}
      <span className="ac-nav__sep" aria-hidden="true" />
      {admin ? (
        <Link href="/admin" className="ac-nav__item">
          {icon(<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" />)}
          Admin
        </Link>
      ) : null}
      <Link href="/" className="ac-nav__item">
        {icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>)}
        Website
      </Link>
      <form action={logout}>
        <button type="submit" className="ac-nav__btn">
          {icon(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />)}
          Log out
        </button>
      </form>
    </nav>
  );
}
