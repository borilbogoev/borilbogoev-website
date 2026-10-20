"use client";

// The only browser code of a landing page. Everything else is server-rendered HTML.
import dynamic from "next/dynamic";
import { Children, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import "@/modules/forms/components/forms.css";
import { LIcon } from "./icons";
import { ratioPadding, type VideoSource } from "../lib/media";

/* -------------------------------------------------------------------------- */
/* Statistics: one beacon per visit, one per click. No cookies, no third party. */
/* -------------------------------------------------------------------------- */

function ids() {
  let v = "";
  let s = "";
  try {
    v = localStorage.getItem("lp_v") ?? "";
    if (!v) localStorage.setItem("lp_v", (v = crypto.randomUUID()));
  } catch {
    v = "";
  }
  try {
    s = sessionStorage.getItem("lp_s") ?? "";
    if (!s) sessionStorage.setItem("lp_s", (s = crypto.randomUUID()));
  } catch {
    s = "";
  }
  return { v: v || "anon", s: s || "anon" };
}

function send(body: Record<string, unknown>) {
  const data = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/landing/t", new Blob([data], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  fetch("/api/landing/t", { method: "POST", body: data, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

export function Track({ pageId }: { pageId: number }) {
  useEffect(() => {
    const { v, s } = ids();
    send({ p: pageId, t: "v", v, s, r: document.referrer.slice(0, 300), q: location.search.slice(0, 400) });
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest<HTMLElement>("[data-lp-b]");
      if (!el || !target?.closest("a,button")) return;
      const link = target.closest("a");
      send({
        p: pageId,
        t: "c",
        v,
        s,
        b: Number(el.dataset.lpB) || 0,
        bt: el.dataset.lpT ?? "",
        l: (el.dataset.lpL || target.closest("a,button")?.textContent || "").trim().slice(0, 100),
        h: (link?.getAttribute("href") ?? el.dataset.lpH ?? "").slice(0, 300),
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pageId]);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Carousel: native scroll-snap, the script only adds arrows, dots and autoplay. */
/* -------------------------------------------------------------------------- */

export function Carousel({ children, perView, autoplay, label }: { children: ReactNode; perView: number; autoplay: number; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [end, setEnd] = useState(false);
  const n = Children.count(children);

  const sync = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const kids = Array.from(t.children) as HTMLElement[];
    let best = 0;
    let dist = Infinity;
    kids.forEach((k, i) => {
      const d = Math.abs(k.offsetLeft - t.scrollLeft);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setIdx(best);
    setEnd(t.scrollLeft + t.clientWidth >= t.scrollWidth - 4);
  }, []);

  const go = useCallback((i: number) => {
    const t = track.current;
    const el = t?.children[Math.max(0, Math.min(n - 1, i))] as HTMLElement | undefined;
    if (t && el) t.scrollTo({ left: el.offsetLeft, behavior: "smooth" });
  }, [n]);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    t.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    on();
    return () => {
      t.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, [sync]);

  useEffect(() => {
    if (!autoplay || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let paused = false;
    const t = track.current;
    const hold = () => (paused = true);
    const free = () => (paused = false);
    t?.addEventListener("pointerenter", hold);
    t?.addEventListener("pointerleave", free);
    t?.addEventListener("focusin", hold);
    t?.addEventListener("focusout", free);
    const timer = setInterval(() => {
      if (paused || document.hidden || !t) return;
      if (t.scrollLeft + t.clientWidth >= t.scrollWidth - 4) go(0);
      else go(Math.round(t.scrollLeft / ((t.children[1] as HTMLElement | undefined)?.offsetLeft || t.clientWidth)) + 1);
    }, autoplay * 1000);
    return () => {
      clearInterval(timer);
      t?.removeEventListener("pointerenter", hold);
      t?.removeEventListener("pointerleave", free);
      t?.removeEventListener("focusin", hold);
      t?.removeEventListener("focusout", free);
    };
  }, [autoplay, n, go]);

  return (
    <div className={`lp-car v${perView}`} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="lp-car__track" ref={track} tabIndex={0} style={{ position: "relative" }}>
        {children}
      </div>
      {n > 1 ? (
        <div className="lp-car__controls">
          <div className="lp-car__dots">
            {Array.from({ length: n }, (_, i) => (
              <button key={i} type="button" aria-label={`Slide ${i + 1}`} aria-current={i === idx} onClick={() => go(i)} />
            ))}
          </div>
          <div className="lp-car__nav">
            <button type="button" className="lp-round" aria-label="Previous slide" disabled={idx === 0} onClick={() => go(idx - 1)}>
              <LIcon name="left" />
            </button>
            <button type="button" className="lp-round" aria-label="Next slide" disabled={end} onClick={() => go(idx + 1)}>
              <LIcon name="right" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Video: a cover image first, the player only after a click.                 */
/* -------------------------------------------------------------------------- */

export type Poster = { src: string; srcSet?: string; width?: number; height?: number };

export function VideoPlayer({ source, title, poster, ratio }: { source: VideoSource; title: string; poster: Poster | null; ratio: string }) {
  const [on, setOn] = useState(false);
  const embed =
    source.kind === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0&modestbranding=1`
      : source.kind === "vimeo"
        ? `https://player.vimeo.com/video/${source.id}?autoplay=1`
        : source.kind === "loom"
          ? `https://www.loom.com/embed/${source.id}?autoplay=1`
          : "";
  return (
    <div className="lp-video" style={{ paddingTop: ratioPadding(ratio) }}>
      {on ? (
        source.kind === "file" ? (
          <video src={source.src} controls autoPlay playsInline title={title} poster={poster?.src} />
        ) : (
          <iframe src={embed} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        )
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play video: ${title}`}>
          {poster ? <img src={poster.src} srcSet={poster.srcSet} sizes="(min-width: 1000px) 1000px, 100vw" width={poster.width} height={poster.height} alt="" loading="lazy" decoding="async" /> : null}
          <span className="lp-play">
            <LIcon name="play" size={28} />
          </span>
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Countdown to a real date                                                   */
/* -------------------------------------------------------------------------- */

const tick = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};

export function Countdown({ target, label, doneText }: { target: string; label: string; doneText: string }) {
  const now = useSyncExternalStore(
    tick,
    () => Math.floor(Date.now() / 1000),
    () => 0, // the server and the first paint show dashes
  );
  const end = Math.floor(Date.parse(target) / 1000);
  const left = now ? end - now : null;
  if (left !== null && left <= 0) return <p className="lp-count__label">{doneText}</p>;
  const cells: [string, number | null][] = [
    ["Days", left === null ? null : Math.floor(left / 86400)],
    ["Hours", left === null ? null : Math.floor((left % 86400) / 3600)],
    ["Min", left === null ? null : Math.floor((left % 3600) / 60)],
    ["Sec", left === null ? null : left % 60],
  ];
  return (
    <div className="lp-count" role="timer" aria-label={label}>
      {label ? <p className="lp-count__label">{label}</p> : null}
      <div className="lp-count__cells">
        {cells.map(([name, v]) => (
          <div className="lp-count__cell" key={name}>
            <strong>{v === null ? "--" : String(v).padStart(2, "0")}</strong>
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sticky action bar on phones                                                */
/* -------------------------------------------------------------------------- */

export function StickyBar({ label, href }: { label: string; href: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.querySelector(".lp-sec, .lp-hero");
    const dest = href.startsWith("#") ? document.getElementById(href.slice(1)) : null;
    const hide = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) hide.add(e.target);
        else hide.delete(e.target);
      }
      setShow(hide.size === 0);
    });
    if (hero) io.observe(hero);
    if (dest) io.observe(dest);
    return () => io.disconnect();
  }, [href]);
  return (
    <div className={`lp-sticky${show ? " is-on" : ""}`} aria-hidden={!show}>
      <a href={href} tabIndex={show ? 0 : -1} className="bb-btn bb-btn-primary" style={{ width: "100%" }} data-lp-b="0" data-lp-t="sticky" data-lp-l={label}>
        {label}
      </a>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Forms module embed, loaded when it is needed                               */
/* -------------------------------------------------------------------------- */

const FormEmbed = dynamic(() => import("@/modules/forms/components/form-embed").then((m) => m.FormEmbed), {
  ssr: false,
  loading: () => (
    <p className="bbf-loading" role="status">
      Loading the form...
    </p>
  ),
});

export function LazyForm({ id, display, label, theme }: { id: number; display: "inline" | "modal"; label: string; theme: "light" | "dark" }) {
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [near, setNear] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || display !== "inline" || near) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) setNear(true);
    }, { rootMargin: "900px" });
    io.observe(el);
    return () => io.disconnect();
  }, [display, near]);

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

  if (display === "inline") {
    return (
      <div ref={host} style={{ minHeight: near ? undefined : 320 }}>
        {near ? <FormEmbed id={id} theme={theme} /> : null}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        className="bb-btn bb-btn-primary bb-btn-lg"
        aria-haspopup="dialog"
        onClick={() => {
          setOpened(true);
          dialog.current?.showModal();
          document.body.style.overflow = "hidden";
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
