"use client";

// A Forms form inside a slide. Same behaviour as the Landing Pages form block, but the form code and its stylesheet
// (~18 kB) load only when a deck actually has a form on it, so decks without one stay light.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const FormEmbed = dynamic(() => import("@/modules/forms/components/form-embed").then((m) => m.FormEmbed), {
  ssr: false,
  loading: () => (
    <p role="status" style={{ color: "var(--s-muted)", fontSize: "0.7em" }}>
      Loading the form...
    </p>
  ),
});

export function DeckForm({ id, display, label, theme }: { id: number; display: "inline" | "modal"; label: string; theme: "light" | "dark" }) {
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [near, setNear] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || display !== "inline" || near) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [display, near]);

  // The dialog needs the form styles before it opens.
  useEffect(() => {
    if (display === "modal") void import("@/modules/forms/components/forms.css");
  }, [display]);

  if (display === "inline") {
    return (
      <div ref={host} style={{ minHeight: near ? undefined : 240 }}>
        {near ? <FormEmbed id={id} theme={theme} /> : null}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        className="pr-btn pr-btn--primary"
        aria-haspopup="dialog"
        onClick={() => {
          setOpened(true);
          dialog.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="bbf-dialog"
        aria-label={label}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("bbf-dialog__inner")) dialog.current?.close();
        }}
      >
        <div className="bbf-dialog__inner">
          <div className="bbf-dialog__panel">
            <button type="button" className="bbf-dialog__close" onClick={() => dialog.current?.close()} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {opened ? <FormEmbed id={id} theme={theme} /> : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
