"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicForm } from "../lib/public-types";
import { FormRenderer } from "./form-renderer";
import "./forms.css";

export type FormEmbedProps = {
  /** The form's number, shown in Forms > Share. */
  id: number;
  /** inline: the form is part of the page. modal: a button opens it in a dialog. */
  display?: "inline" | "modal";
  /** Text of the button (modal only). */
  label?: string;
  /** Classes of the button (modal only). Defaults to the site's primary button. */
  buttonClassName?: string;
  /** Overrides the form's own look for this placement. */
  theme?: "light" | "dark";
  layout?: "classic" | "conversational";
};

type Load = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; form: PublicForm };

/** Fetches a form's definition. Always fresh, so status changes apply at once. */
export function useForm(id: number, enabled: boolean): Load {
  const [result, setResult] = useState<{ id: number; load: Load } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch(`/api/forms/${id}/definition`, { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as PublicForm & { error?: string };
        if (!alive) return;
        setResult({ id, load: r.ok ? { status: "ready", form: body } : { status: "error", message: body.error ?? "This form is not available." } });
      })
      .catch(() => alive && setResult({ id, load: { status: "error", message: "This form could not be loaded. Check your connection and reload." } }));
    return () => {
      alive = false;
    };
  }, [id, enabled]);
  if (!enabled) return { status: "idle" };
  return result && result.id === id ? result.load : { status: "loading" };
}

function Body({ load, theme, layout }: { load: Load; theme?: "light" | "dark"; layout?: "classic" | "conversational" }) {
  if (load.status === "ready") return <FormRenderer form={{ ...load.form, theme: theme ?? load.form.theme, mode: layout ?? load.form.mode }} />;
  if (load.status === "error") return <p className="bbf-loading" role="alert">{load.message}</p>;
  return <p className="bbf-loading" role="status">Loading the form...</p>;
}

/** Inline placement: the form loads as soon as it is near the screen. */
function Inline({ id, theme, layout }: Pick<FormEmbedProps, "id" | "theme" | "layout">) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) {
      const t = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const load = useForm(id, near);
  return (
    <div ref={ref} className="bbf-inline-host" style={{ minHeight: near ? undefined : 240 }}>
      {near ? <Body load={load} theme={theme} layout={layout} /> : null}
    </div>
  );
}

/** Modal placement: a button opens the form in a dialog. The answers stay if the visitor closes and reopens it. */
function Modal({ id, label, buttonClassName, theme, layout }: Pick<FormEmbedProps, "id" | "label" | "buttonClassName" | "theme" | "layout">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const load = useForm(id, opened);

  const open = () => {
    setOpened(true);
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
  };
  const close = useCallback(() => {
    dialog.current?.close();
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const restore = () => {
      document.body.style.overflow = "";
    };
    d.addEventListener("close", restore);
    return () => {
      d.removeEventListener("close", restore);
      restore();
    };
  }, []);

  return (
    <>
      <button type="button" className={buttonClassName ?? "bb-btn bb-btn-primary"} onClick={open} aria-haspopup="dialog">
        {label ?? "Open the form"}
      </button>
      <dialog
        ref={dialog}
        className="bbf-dialog"
        aria-label={label ?? "Form"}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("bbf-dialog__inner")) close();
        }}
      >
        <div className="bbf-dialog__inner">
          <div className="bbf-dialog__panel">
            <button type="button" className="bbf-dialog__close" onClick={close} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {opened ? <Body load={load} theme={theme} layout={layout} /> : null}
          </div>
        </div>
      </dialog>
    </>
  );
}

/**
 * Puts a form on a page. Use it in any page or component:
 *
 *   <FormEmbed id={1} />                                   the form itself, in place
 *   <FormEmbed id={1} display="modal" label="Join" />      a button that opens the form in a dialog
 */
export function FormEmbed({ id, display = "inline", label, buttonClassName, theme, layout }: FormEmbedProps) {
  return display === "modal" ? <Modal id={id} label={label} buttonClassName={buttonClassName} theme={theme} layout={layout} /> : <Inline id={id} theme={theme} layout={layout} />;
}

/** The standalone page of a form (/s/<slug>): the form on a clean background, loaded at once. */
export function FormPage({ id, theme }: { id: number; theme: "light" | "dark" }) {
  const load = useForm(id, true);
  const t = load.status === "ready" ? load.form.theme : theme;
  return (
    <div className={`bbf-page-shell is-${t}`}>
      <Body load={load} />
    </div>
  );
}
