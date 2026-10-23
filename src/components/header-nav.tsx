"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { nav, site } from "@/content/site";
import { CloseIcon, ExternalIcon, MenuIcon } from "./icons";
import { Monogram } from "./monogram";
import { PortraitMark } from "./portrait-mark";
import { StreamlinerLogo } from "./streamliner-logo";

const linkBase =
  "relative inline-flex items-center text-[14px] font-medium text-muted transition-colors hover:text-brand-text";

export function HeaderNav() {
  const pathname = usePathname();
  // The drawer is open only for the page it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const [scrolled, setScrolled] = useState(false);

  const close = useCallback(() => setOpenAt(null), []);

  // Shadow once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock page scroll and close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
    <header
      className="sticky top-0 z-50 border-b border-line backdrop-blur-md transition-shadow"
      style={{ background: "var(--nav-glass)", boxShadow: scrolled ? "var(--shadow-nav)" : undefined }}
    >
      <div className="container-bb flex h-16 items-center justify-between">
        <Link href="/" aria-label={`${site.name}, home`} className="-ml-1 inline-flex items-center p-1" onClick={close}>
          <Monogram height={30} />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {nav.map((item) =>
            item.kind === "streamliner" ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener"
                aria-label="The Streamliner (opens in a new tab)"
                className="inline-flex items-center opacity-90 transition-opacity hover:opacity-100"
              >
                <StreamlinerLogo height={22} />
              </a>
            ) : item.kind === "portrait" ? (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive(item.href) ? "page" : undefined}
                className="inline-flex items-center"
              >
                <PortraitMark active={isActive(item.href)} />
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`${linkBase} py-2 ${isActive(item.href) ? "!text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand" : ""}`}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <button
          type="button"
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpenAt(open ? null : pathname)}
        >
          {open ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
        </button>
      </div>
    </header>

      {/* Mobile drawer: full width, 56px rows, thumb-sized targets.
          It sits outside <header>: the header's backdrop blur would otherwise become the containing block of this fixed panel. */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto overscroll-contain border-t border-line bg-surface lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <nav aria-label="Mobile" className="container-bb py-2">
          <ul className="m-0 list-none p-0">
            {nav.map((item) => (
              <li key={item.href} className="border-b border-line">
                {item.kind === "streamliner" ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener"
                    onClick={close}
                    className="flex min-h-[60px] items-center justify-between"
                    aria-label="The Streamliner (opens in a new tab)"
                  >
                    <StreamlinerLogo height={26} />
                    <ExternalIcon size={18} className="text-muted" />
                  </a>
                ) : item.kind === "portrait" ? (
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`flex min-h-[60px] items-center justify-between text-[18px] font-semibold ${isActive(item.href) ? "text-brand-text" : "text-ink"}`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <PortraitMark />
                      {item.label}
                    </span>
                    {isActive(item.href) && <span aria-hidden className="h-2 w-2 rounded-full bg-brand" />}
                  </Link>
                ) : (
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`flex min-h-[56px] items-center justify-between text-[18px] font-semibold ${isActive(item.href) ? "text-brand-text" : "text-ink"}`}
                  >
                    {item.label}
                    {isActive(item.href) && <span aria-hidden className="h-2 w-2 rounded-full bg-brand" />}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="t-caption mt-6 text-muted">{site.tagline}</p>
        </nav>
      </div>
    </>
  );
}
