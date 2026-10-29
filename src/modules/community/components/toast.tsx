"use client";

import { useSyncExternalStore } from "react";

type Toast = { id: number; text: string; tone: "ok" | "error" };
let list: Toast[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function toast(text: string, tone: Toast["tone"] = "ok") {
  const id = ++seq;
  list = [...list, { id, text, tone }];
  emit();
  setTimeout(() => {
    list = list.filter((x) => x.id !== id);
    emit();
  }, 4500);
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => void subs.delete(fn);
};

/** Mounted once in the Community shell. Announced politely to screen readers. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => list, () => list);
  return (
    <div className="cm-toasts" role="status" aria-live="polite">
      {items.map((x) => (
        <div key={x.id} className={`cm-toast cm-toast--${x.tone}`}>
          {x.text}
        </div>
      ))}
    </div>
  );
}
