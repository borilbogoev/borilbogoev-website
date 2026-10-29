"use client";

import { useState } from "react";
import { message, post } from "../lib/client";
import { t } from "../strings";
import { toast } from "./toast";

/** Optimistic: the heart flips at once and rolls back if the server says no. */
export function LikeButton({ type, id, liked: initialLiked, count: initialCount, disabled }: { type: "post" | "comment"; id: number; liked: boolean; count: number; disabled?: boolean }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy || id < 0) return;
    const want = !liked;
    setBusy(true);
    setLiked(want);
    setCount((n) => Math.max(0, n + (want ? 1 : -1)));
    try {
      const r = await post<{ liked: boolean; likeCount: number }>("/api/community/likes", { targetType: type, targetId: id, like: want });
      setLiked(r.liked);
      setCount(r.likeCount);
    } catch (e) {
      setLiked(!want);
      setCount((n) => Math.max(0, n + (want ? -1 : 1)));
      toast(message(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`cm-like${liked ? " is-on" : ""}`} onClick={toggle} disabled={disabled} aria-pressed={liked} aria-label={`${liked ? t.like.liked : t.like.like}. ${t.like.count(count)}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6.2 5.3 5.3 0 0 1 21.3 12C19 16.6 12 21 12 21z" />
      </svg>
      <span aria-hidden="true">{count}</span>
    </button>
  );
}
