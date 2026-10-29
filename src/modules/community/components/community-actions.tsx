"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { message, post } from "../lib/client";
import { t } from "../strings";
import { toast } from "./toast";

export function JoinButton({ slug, joined, canLeave, canJoin }: { slug: string; joined: boolean; canLeave: boolean; canJoin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (joined && !canLeave) return null;
  if (!joined && !canJoin) return null;
  return (
    <button
      type="button"
      className={joined ? "bb-btn bb-btn-outline" : "bb-btn bb-btn-primary"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await post(`/api/community/${slug}/${joined ? "leave" : "join"}`);
          router.refresh();
        } catch (e) {
          toast(message(e), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {joined ? t.action.leave : t.action.join}
    </button>
  );
}

export function CommunitySwitcher({ current, options }: { current: string; options: { slug: string; name: string }[] }) {
  const router = useRouter();
  if (options.length < 2) return null;
  return (
    <label className="cm-switcher">
      <span className="cm-sr">{t.community.switcher}</span>
      <select value={current} onChange={(e) => router.push(`/community/${e.target.value}`)}>
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
