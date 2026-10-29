"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { accountLogout } from "@/modules/account/actions";
import { ACCOUNT_NAV } from "@/modules/account/components/nav";

type Me = { signedIn: boolean; name?: string; avatarUrl?: string; admin?: boolean };

/**
 * A second bar under the main menu for signed-in visitors: the same options as the My account menu, laid out horizontally.
 * The public pages are static, so the bar asks /api/account/me after load; signed-out visitors see nothing.
 * It is hidden inside /account, where the full menu is already on screen.
 */
export function AccountBar() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const inArea = pathname === "/account" || pathname.startsWith("/account/");

  useEffect(() => {
    if (inArea) return;
    let live = true;
    fetch("/api/account/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : { signedIn: false }))
      .catch(() => ({ signedIn: false }))
      .then((m) => live && setMe(m));
    return () => {
      live = false;
    };
  }, [pathname, inArea]);

  if (inArea || !me?.signedIn) return null;
  const on = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const initials = (me.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <div className="border-t border-line" style={{ background: "var(--surface-alt)" }}>
      <nav aria-label="My account" className="container-bb flex h-11 items-center justify-between gap-4">
        <ul className="m-0 flex min-w-0 list-none items-center gap-1 overflow-x-auto p-0 [scrollbar-width:none]">
          {ACCOUNT_NAV.map((i) => (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={on(i.href, i.exact) ? "page" : undefined}
                className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-ink no-underline transition-colors hover:bg-white aria-[current=page]:bg-brand-tint aria-[current=page]:text-brand-text"
              >
                {i.icon}
                {i.label}
              </Link>
            </li>
          ))}
          {me.admin ? (
            <li className="shrink-0">
              <Link href="/admin" className="inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold text-ink no-underline hover:bg-white">
                Admin
              </Link>
            </li>
          ) : null}
        </ul>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/account/info" className="hidden items-center gap-2 text-[13px] font-semibold text-ink no-underline sm:inline-flex">
            <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold" style={{ background: "var(--surface-inverse)", color: "var(--on-inverse)" }} aria-hidden="true">
              {me.avatarUrl ? <img src={me.avatarUrl} alt="" width={24} height={24} className="h-full w-full object-cover" /> : initials}
            </span>
            <span className="max-w-[140px] truncate">{me.name}</span>
          </Link>
          <form action={accountLogout}>
            <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-muted hover:text-brand-text">
              Log out
            </button>
          </form>
        </div>
      </nav>
    </div>
  );
}
