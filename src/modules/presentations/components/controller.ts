// The browser side of a deck, written as plain DOM code so it works on the server-rendered page and on a deck that was
// drawn in the browser after a password. It attaches to the data attributes written by deck.tsx.
// Slides mode: one slide fills the window, keys and swipes move through it, "click" builds appear one by one.
// Accordion mode: a normal page whose sections fold open and shut.
// Statistics: one beacon when the deck opens, one with the furthest slide and the time, no cookies, no third party.

type Mode = "slides" | "accordion";

const FOCUSABLE_INPUT = /^(INPUT|TEXTAREA|SELECT)$/;

function ids() {
  let v = "";
  let s = "";
  try {
    v = localStorage.getItem("pr_v") ?? "";
    if (!v) localStorage.setItem("pr_v", (v = crypto.randomUUID()));
  } catch {
    v = "";
  }
  try {
    s = sessionStorage.getItem("pr_s") ?? "";
    if (!s) sessionStorage.setItem("pr_s", (s = crypto.randomUUID()));
  } catch {
    s = "";
  }
  return { v: v || "anon", s: s || "anon" };
}

/**
 * Changes the address bar without telling the Next.js router. Next wraps history.replaceState and treats every call as a
 * navigation of its own, which reloads the page. The deck only needs the #slide and ?mode parts to be shareable.
 */
function replaceUrl(url: string | URL) {
  try {
    History.prototype.replaceState.call(history, history.state, "", url);
  } catch {
    // some embedded browsers refuse; the deck works without it
  }
}

function beacon(body: Record<string, unknown>) {
  const data = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/presentations/t", new Blob([data], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  fetch("/api/presentations/t", { method: "POST", body: data, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

/** Attaches the deck behaviour to `root` (the .pr element). Returns a function that removes everything again. */
export function mountDeck(root: HTMLElement): () => void {
  const q = <T extends HTMLElement>(sel: string, from: ParentNode = root) => from.querySelector<T>(sel);
  const qa = <T extends HTMLElement>(sel: string, from: ParentNode = root) => Array.from(from.querySelectorAll<T>(sel));
  const slides = qa<HTMLElement>(".pr-slide");
  const total = slides.length;
  const multi = root.dataset.multi === "1";
  const loop = root.dataset.loop === "1";
  const autoplay = Number(root.dataset.autoplay) || 0;
  const canSwitch = root.dataset.switch === "1";
  const presenter = root.dataset.presenter === "1";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cleanups: (() => void)[] = [];
  const on = (target: Document | Window | HTMLElement, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  let mode: Mode = root.dataset.mode === "accordion" ? "accordion" : "slides";
  let cur = 0;
  let maxReached = 0;
  const revealed = new Map<number, number>();
  let timer = 0;
  let idle = 0;

  if (!total) return () => {};

  /* ---------- build steps ---------- */

  const stepsOf = (i: number) => qa<HTMLElement>('[data-build="click"], [data-build-items] > li', slides[i]);
  const applySteps = (i: number, n: number) => stepsOf(i).forEach((el, k) => el.classList.toggle("pr-pre", k >= n));
  const allSteps = (i: number) => stepsOf(i).length;

  /* ---------- embeds and video ---------- */

  const loadEmbeds = (i: number) => {
    const s = slides[i];
    if (!s) return;
    for (const f of qa<HTMLIFrameElement>("iframe[data-src]", s)) {
      if (!f.getAttribute("src")) f.setAttribute("src", f.dataset.src ?? "");
    }
  };

  on(root, "click", (e) => {
    const btn = (e.target as Element).closest<HTMLElement>(".pr-video__btn");
    if (!btn) return;
    const { videoKind: kind, videoId: id, videoSrc: src, videoTitle: title, videoPoster: poster } = btn.dataset;
    const box = btn.parentElement;
    if (!box) return;
    let el: HTMLElement;
    if (kind === "file") {
      const v = document.createElement("video");
      v.src = src ?? "";
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      if (poster) v.poster = poster;
      el = v;
    } else {
      const f = document.createElement("iframe");
      f.src =
        kind === "youtube"
          ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`
          : kind === "vimeo"
            ? `https://player.vimeo.com/video/${id}?autoplay=1`
            : `https://www.loom.com/embed/${id}?autoplay=1`;
      f.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.title = title ?? "Video";
      el = f;
    }
    box.replaceChildren(el);
  });

  /* ---------- chrome state ---------- */

  const countNow = q("[data-count-now]");
  const countTotal = q("[data-count-total]");
  const bar = q("[data-progress]");
  const notesText = q("[data-notes-text]");
  const outline = q(".pr-outline");
  const notesPanel = q(".pr-notes");
  const help = q(".pr-help");
  const pad = (n: number) => String(n).padStart(2, "0");
  if (countTotal) countTotal.textContent = pad(total);

  const paint = () => {
    if (countNow) countNow.textContent = pad(cur + 1);
    if (bar) bar.style.transform = `scaleX(${total > 1 ? cur / (total - 1) : 1})`;
    // The chrome follows the slide in slides mode, and the theme in accordion mode (the page behind it is not the slide).
    root.dataset.tone = mode === "slides" ? (slides[cur]?.dataset.tone ?? "light") : root.dataset.theme === "dark" ? "dark" : "light";
    for (const b of qa<HTMLElement>("[data-go]", outline ?? root)) b.classList.toggle("is-current", Number(b.dataset.go) === cur);
    if (notesText) notesText.textContent = q(".pr-notes-src", slides[cur])?.textContent || "No notes for this slide.";
  };

  const hashFor = (i: number) => `#${slides[i].id}`;
  const writeHash = () => {
    replaceUrl(`${location.pathname}${location.search}${hashFor(cur)}`);
  };

  /* ---------- slides mode ---------- */

  const go = (to: number, opts: { quiet?: boolean } = {}) => {
    const i = Math.max(0, Math.min(total - 1, to));
    const from = cur;
    cur = i;
    maxReached = Math.max(maxReached, i);
    if (mode === "slides") {
      root.dataset.dir = i >= from ? "fwd" : "back";
      slides.forEach((s, k) => {
        s.classList.toggle("is-active", k === i);
        s.classList.toggle("is-before", k < i);
        s.classList.toggle("is-after", k > i);
        s.inert = k !== i;
        s.setAttribute("aria-hidden", k === i ? "false" : "true");
      });
      // Going forward the builds start hidden; coming back shows the slide complete.
      const n = i > from ? 0 : allSteps(i);
      revealed.set(i, n);
      applySteps(i, n);
      loadEmbeds(i);
      loadEmbeds(i + 1);
      slides[i].scrollTop = 0;
      q(".pr-slide__body", slides[i])?.scrollTo?.({ top: 0 });
    }
    paint();
    if (!opts.quiet) writeHash();
    schedule();
  };

  const next = () => {
    if (mode !== "slides") return;
    const done = revealed.get(cur) ?? 0;
    if (done < allSteps(cur)) {
      revealed.set(cur, done + 1);
      applySteps(cur, done + 1);
      schedule();
      return;
    }
    if (cur < total - 1) go(cur + 1);
    else if (loop) go(0);
  };
  const prev = () => {
    if (mode !== "slides") return;
    if (cur > 0) go(cur - 1);
    else if (loop) go(total - 1);
  };

  function schedule() {
    window.clearTimeout(timer);
    if (autoplay > 0 && mode === "slides" && !reduced && !document.hidden) timer = window.setTimeout(next, autoplay * 1000);
  }

  /* ---------- accordion mode ---------- */

  const setOpen = (i: number, open: boolean) => {
    const s = slides[i];
    s.dataset.open = open ? "1" : "0";
    q(".pr-acc", s)?.setAttribute("aria-expanded", String(open));
    if (open) {
      loadEmbeds(i);
      cur = i;
      maxReached = Math.max(maxReached, i);
      paint();
    }
  };
  const toggle = (i: number) => {
    const open = slides[i].dataset.open !== "1";
    if (open && !multi) slides.forEach((_, k) => k !== i && setOpen(k, false));
    setOpen(i, open);
    if (open) replaceUrl(`${location.pathname}${location.search}${hashFor(i)}`);
  };

  /* ---------- mode switch ---------- */

  const setMode = (m: Mode) => {
    if (m === mode) return;
    mode = m;
    root.dataset.mode = m;
    root.classList.remove("is-idle");
    const toggleBtn = q('[data-act="mode"]');
    if (toggleBtn) toggleBtn.setAttribute("aria-label", m === "accordion" ? "Show as slides" : "Show as accordion");
    if (m === "slides") {
      go(cur);
    } else {
      paint();
      window.clearTimeout(timer);
      slides.forEach((s) => {
        s.inert = false;
        s.removeAttribute("aria-hidden");
      });
      if (slides.every((s) => s.dataset.open !== "1")) setOpen(cur, true);
      loadEmbeds(cur);
      requestAnimationFrame(() => slides[cur]?.scrollIntoView({ block: "start" }));
    }
    const u = new URL(location.href);
    u.searchParams.set("mode", m);
    replaceUrl(u);
  };

  /* ---------- panels ---------- */

  const panel = (el: HTMLElement | null, btnAct: string, force?: boolean) => {
    if (!el) return;
    const open = force ?? el.hidden;
    el.hidden = !open;
    for (const b of qa<HTMLElement>(`[data-act="${btnAct}"]`)) {
      if (b.hasAttribute("aria-expanded")) b.setAttribute("aria-expanded", String(open));
      if (b.hasAttribute("aria-pressed")) b.setAttribute("aria-pressed", String(open));
    }
    root.classList.toggle(`has-${btnAct}`, open);
  };
  const closePanels = () => {
    const was = [outline, notesPanel, help].some((p) => p && !p.hidden);
    panel(outline, "outline", false);
    panel(notesPanel, "notes", false);
    panel(help, "help", false);
    return was;
  };

  on(root, "click", (e) => {
    const t = e.target as Element;
    const act = t.closest<HTMLElement>("[data-act]")?.dataset.act;
    const goBtn = t.closest<HTMLElement>("[data-go]");
    const acc = t.closest<HTMLElement>(".pr-acc");
    if (acc) {
      const i = slides.indexOf(acc.closest<HTMLElement>(".pr-slide") as HTMLElement);
      if (i > -1) toggle(i);
      return;
    }
    if (goBtn) {
      const i = Number(goBtn.dataset.go);
      if (mode === "slides") go(i);
      else {
        setOpen(i, true);
        slides[i].scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
      if (window.matchMedia("(max-width: 900px)").matches) panel(outline, "outline", false);
      return;
    }
    switch (act) {
      case "next":
        next();
        break;
      case "prev":
        prev();
        break;
      case "outline":
        panel(outline, "outline");
        break;
      case "notes":
        panel(notesPanel, "notes");
        break;
      case "help":
        panel(help, "help");
        break;
      case "mode":
        if (canSwitch) setMode(mode === "slides" ? "accordion" : "slides");
        break;
      case "expand":
        slides.forEach((_, k) => setOpen(k, true));
        break;
      case "collapse":
        slides.forEach((_, k) => setOpen(k, false));
        break;
    }
  });

  /* ---------- keys, touch, idle ---------- */

  on(document, "keydown", (e) => {
    const k = e as KeyboardEvent;
    const t = k.target as HTMLElement | null;
    if (k.ctrlKey || k.metaKey || k.altKey) return;
    if (t && (FOCUSABLE_INPUT.test(t.tagName) || t.isContentEditable)) return;
    const onControl = !!t?.closest("button, a, summary");
    switch (k.key) {
      case "ArrowRight":
      case "PageDown":
        if (mode === "slides") {
          k.preventDefault();
          next();
        }
        break;
      case "ArrowLeft":
      case "PageUp":
        if (mode === "slides") {
          k.preventDefault();
          prev();
        }
        break;
      case " ":
        if (mode === "slides" && !onControl) {
          k.preventDefault();
          if (k.shiftKey) prev();
          else next();
        }
        break;
      case "Home":
        if (mode === "slides") {
          k.preventDefault();
          go(0);
        }
        break;
      case "End":
        if (mode === "slides") {
          k.preventDefault();
          go(total - 1);
        }
        break;
      case "o":
      case "O":
        panel(outline, "outline");
        break;
      case "m":
      case "M":
        if (canSwitch) setMode(mode === "slides" ? "accordion" : "slides");
        break;
      case "n":
      case "N":
        if (presenter) panel(notesPanel, "notes");
        break;
      case "?":
        panel(help, "help");
        break;
      case "Escape":
        closePanels();
        break;
    }
  });

  let sx = 0;
  let sy = 0;
  let swipeOk = false;
  on(root, "touchstart", (e) => {
    const t = (e as TouchEvent).touches[0];
    sx = t.clientX;
    sy = t.clientY;
    swipeOk = mode === "slides" && !(e.target as Element).closest(".pr-table-wrap, .pr-code, iframe, video, .pr-panel, .pr-help");
  }, { passive: true });
  on(root, "touchend", (e) => {
    if (!swipeOk) return;
    const t = (e as TouchEvent).changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else prev();
    }
  }, { passive: true });

  const wake = () => {
    root.classList.remove("is-idle");
    window.clearTimeout(idle);
    if (mode === "slides") idle = window.setTimeout(() => !root.matches(":focus-within") && root.classList.add("is-idle"), 3000);
  };
  on(root, "pointermove", wake, { passive: true });
  on(document, "keydown", wake);
  on(root, "touchstart", wake, { passive: true });

  on(window, "hashchange", () => {
    const i = slides.findIndex((s) => `#${s.id}` === location.hash);
    if (i < 0) return;
    if (mode === "slides") go(i, { quiet: true });
    else {
      setOpen(i, true);
      slides[i].scrollIntoView({ block: "start" });
    }
  });

  /* ---------- statistics ---------- */

  const pid = Number(root.dataset.pid) || 0;
  let seconds = 0;
  let lastTick = document.hidden ? 0 : Date.now();
  let sentKey = "";
  const { v, s } = pid ? ids() : { v: "", s: "" };
  const flush = () => {
    if (!pid) return;
    if (lastTick) {
      seconds += Math.round((Date.now() - lastTick) / 1000);
      lastTick = Date.now();
    }
    const key = `${maxReached}:${seconds}`;
    if (key === sentKey || seconds < 1) return;
    sentKey = key;
    beacon({ p: pid, t: "p", v, s, x: maxReached + 1, d: Math.min(seconds, 14400) });
  };
  if (pid) {
    beacon({ p: pid, t: "v", v, s, m: mode, r: document.referrer.slice(0, 300), q: location.search.slice(0, 400) });
    const every = window.setInterval(flush, 20000);
    cleanups.push(() => window.clearInterval(every));
  }
  on(document, "visibilitychange", () => {
    if (document.hidden) {
      flush();
      lastTick = 0;
      window.clearTimeout(timer);
    } else {
      lastTick = Date.now();
      schedule();
    }
  });
  on(window, "pagehide", flush);

  /* ---------- start ---------- */

  const asked = new URLSearchParams(location.search).get("mode");
  if (canSwitch && (asked === "slides" || asked === "accordion") && asked !== mode) {
    mode = asked;
    root.dataset.mode = asked;
  }
  const fromHash = slides.findIndex((x) => `#${x.id}` === location.hash);
  if (mode === "accordion") {
    slides.forEach((sl, k) => setOpen(k, sl.dataset.open === "1" || k === fromHash));
    if (fromHash > -1) requestAnimationFrame(() => slides[fromHash].scrollIntoView({ block: "start" }));
    cur = Math.max(0, fromHash);
    paint();
  } else {
    go(fromHash > -1 ? fromHash : 0, { quiet: true });
  }
  requestAnimationFrame(() => root.classList.add("is-ready"));
  wake();

  return () => {
    flush();
    window.clearTimeout(timer);
    window.clearTimeout(idle);
    cleanups.forEach((fn) => fn());
    root.classList.remove("is-ready", "is-idle");
  };
}
