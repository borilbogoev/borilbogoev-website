"use client";

import { useEffect, useState } from "react";

/**
 * A bottom bar on phones with the one red action. It shows only while the hero, the inquiry form
 * and the footer are all off screen, so it never doubles up with another call to action.
 */
export function StickyCta({ label = "Send an Inquiry", href = "#inquiry" }: { label?: string; href?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hide = new Set<Element>();
    const targets = ["#offer-hero", "#inquiry", "footer"].map((s) => document.querySelector(s)).filter(Boolean) as Element[];
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) hide.add(entry.target);
        else hide.delete(entry.target);
      }
      setShow(hide.size === 0);
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <div
      className={`no-print fixed inset-x-0 bottom-0 z-40 border-t border-line px-5 pt-3 transition-transform duration-200 md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
      style={{ background: "var(--nav-glass)", paddingBottom: "max(12px, env(safe-area-inset-bottom))", backdropFilter: "blur(12px)" }}
      aria-hidden={!show}
    >
      <a href={href} tabIndex={show ? 0 : -1} className="bb-btn bb-btn-primary w-full">
        {label}
      </a>
    </div>
  );
}
