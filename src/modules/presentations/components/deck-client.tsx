"use client";

// Browser-side parts of the public deck: the controller for a server-rendered deck, and the lock screen for a protected one.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Monogram } from "@/components/monogram";
import type { DeckSlide } from "../lib/slides";
import { DeckView, type DeckViewDeck } from "./deck";
import { mountDeck } from "./controller";

/** Attaches slides, keys, accordion and statistics to the deck already on the page. */
export function DeckMount() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".pr[data-slug]");
    return root ? mountDeck(root) : undefined;
  }, []);
  return null;
}

type Unlocked = { deck: DeckViewDeck; slides: DeckSlide[]; token: string };

async function requestUnlock(slug: string, body: { password?: string; token?: string }): Promise<Unlocked> {
  const res = await fetch("/api/presentations/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) });
  const json = (await res.json().catch(() => ({}))) as Partial<Unlocked> & { error?: string };
  if (!res.ok || !json.deck || !json.slides || !json.token) throw new Error(json.error || "The password is not right.");
  return { deck: json.deck, slides: json.slides, token: json.token };
}

/**
 * A password-protected deck. The page itself carries no slides: they come from the server only after the right password
 * (or the token kept for this browser tab), so the content is not in the HTML that anyone can fetch.
 */
export function ProtectedDeck({ slug, title, subtitle }: { slug: string; title: string; subtitle: string }) {
  const [data, setData] = useState<Unlocked | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const key = `pr_unlock_${slug}`;

  useEffect(() => {
    let token = "";
    try {
      token = sessionStorage.getItem(key) ?? "";
    } catch {
      token = "";
    }
    if (!token) {
      void Promise.resolve().then(() => setChecking(false));
      return;
    }
    requestUnlock(slug, { token })
      .then(setData)
      .catch(() => sessionStorage.removeItem(key))
      .finally(() => setChecking(false));
  }, [slug, key]);

  useEffect(() => {
    if (!data) return;
    const root = wrap.current?.querySelector<HTMLElement>(".pr[data-slug]");
    return root ? mountDeck(root) : undefined;
  }, [data]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError("");
    try {
      const next = await requestUnlock(slug, { password });
      try {
        sessionStorage.setItem(key, next.token);
      } catch {
        // the tab will ask again after a reload
      }
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password is not right.");
      setBusy(false);
    }
  };

  if (data) {
    return (
      <div ref={wrap}>
        <DeckView deck={data.deck} slides={data.slides} track unlockToken={data.token} />
      </div>
    );
  }

  return (
    <main className="pr-lock">
      <form onSubmit={submit} className="pr-lock__box" aria-busy={busy || checking}>
        <Monogram height={34} />
        <p className="pr-eyebrow">Private presentation</p>
        <h1>
          {title.replace(/\.$/, "")}
          <span className="pr-dot">.</span>
        </h1>
        {subtitle ? <p className="pr-sub">{subtitle}</p> : null}
        <label>
          <span>Password</span>
          <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || checking} aria-invalid={!!error} aria-describedby={error ? "pr-lock-error" : undefined} />
        </label>
        {error ? (
          <p id="pr-lock-error" role="alert" className="pr-lock__error">
            {error}
          </p>
        ) : null}
        <button type="submit" className="pr-btn pr-btn--primary" disabled={busy || checking || !password}>
          Open Presentation
        </button>
      </form>
    </main>
  );
}
