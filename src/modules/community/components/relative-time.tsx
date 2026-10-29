"use client";

import { useSyncExternalStore } from "react";

// One shared clock for every timestamp on the page, ticking once a minute. The server renders a fixed date,
// the browser swaps in "5 min ago" after hydration, in the viewer's own time zone.
const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const snapshot = () => {
  if (!now) now = Date.now();
  return now;
};

export function relative(iso: string, at: number): string {
  const s = Math.max(0, Math.round((at - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: new Date(iso).getFullYear() === new Date(at).getFullYear() ? undefined : "numeric" });
}

export function RelativeTime({ iso }: { iso: string }) {
  const at = useSyncExternalStore(subscribe, snapshot, () => 0);
  const full = at ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : undefined;
  return (
    <time dateTime={iso} title={full} suppressHydrationWarning>
      {at ? relative(iso, at) : iso.slice(0, 10)}
    </time>
  );
}
