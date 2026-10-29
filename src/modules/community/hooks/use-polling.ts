"use client";

import { useEffect, useRef } from "react";

export type PollingOptions = {
  intervalMs: number;
  enabled?: boolean;
  /** Changing this restarts the loop and cancels the call in flight (a different post, a different thread). */
  key?: string | number;
};

/**
 * Calls `fn` on an interval and nothing else. It
 *  - waits while the tab is hidden, and makes one catch-up call the moment the tab is visible again;
 *  - adds +/- 20% jitter so many tabs do not hit the server together;
 *  - backs off exponentially after errors (up to 60 s) and resets after a success;
 *  - aborts the request in flight on unmount or when `key` changes;
 *  - waits while the browser is offline.
 * `fn` gets an AbortSignal. Throw to signal an error (this triggers the back-off).
 */
export function usePolling(fn: (signal: AbortSignal) => Promise<void>, { intervalMs, enabled = true, key }: PollingOptions) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;

    const active = () => document.visibilityState === "visible" && navigator.onLine;

    const schedule = () => {
      clearTimeout(timer);
      if (stopped || !active()) return;
      const base = failures ? Math.min(60_000, intervalMs * 2 ** failures) : intervalMs;
      timer = setTimeout(tick, base * (0.8 + Math.random() * 0.4));
    };

    const tick = async () => {
      if (stopped || !active()) return;
      controller?.abort();
      const mine = new AbortController();
      controller = mine;
      try {
        await latest.current(mine.signal);
        failures = 0;
      } catch {
        if (mine.signal.aborted) return;
        failures += 1;
      }
      schedule();
    };

    const wake = () => {
      clearTimeout(timer);
      if (active()) void tick();
    };

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", wake);
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", wake);
    };
  }, [intervalMs, enabled, key]);
}
