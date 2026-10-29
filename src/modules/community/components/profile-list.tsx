"use client";

import Link from "next/link";
import { useState } from "react";
import { get, message, type People } from "../lib/client";
import { t } from "../strings";
import { RelativeTime } from "./relative-time";

export type Item = { kind: "post" | "comment" | "mention"; id: number; communitySlug: string; communityName: string; postId: number; createdAt: string; snippet: string; commentCount?: number; imageCount?: number; by?: string; href: string; cursor: string };

export function ProfileList({ userId, section, communityId, initial, initialNext, initialPeople, empty }: { userId: string; section: string; communityId: number | null; initial: Item[]; initialNext: string | null; initialPeople: People; empty: string }) {
  const [items, setItems] = useState(initial);
  const [people, setPeople] = useState(initialPeople);
  const [next, setNext] = useState(initialNext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function more() {
    if (!next) return;
    setBusy(true);
    setError("");
    try {
      const p = new URLSearchParams({ section, cursor: next });
      if (communityId) p.set("communityId", String(communityId));
      const r = await get<{ items: Item[]; people: People; nextCursor: string | null }>(`/api/community/profile/${userId}?${p}`);
      setItems((cur) => [...cur, ...r.items]);
      setPeople((c) => ({ ...c, ...r.people }));
      setNext(r.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  if (!items.length) return <div className="cm-empty"><p>{empty}</p></div>;
  return (
    <div>
      <ul className="cm-list">
        {items.map((i) => (
          <li key={`${i.kind}-${i.id}-${i.cursor}`}>
            <Link href={i.href} className="cm-row">
              <span className="cm-row__meta cm-muted">
                {i.communityName} · <RelativeTime iso={i.createdAt} />
                {i.kind === "mention" && i.by ? ` · ${t.profile.mentionedBy(people[i.by]?.name ?? "Member")}` : ""}
              </span>
              <span className="cm-row__text">{i.snippet || (i.imageCount ? "Image" : "")}</span>
              {i.kind === "post" ? <span className="cm-muted">{t.post.comments(i.commentCount ?? 0)}{i.imageCount ? ` · ${i.imageCount} ${i.imageCount === 1 ? "image" : "images"}` : ""}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {error ? <p className="cm-error" role="alert">{error} <button type="button" className="cm-link-btn" onClick={more}>{t.action.retry}</button></p> : null}
      {next ? <div className="cm-more"><button type="button" className="bb-btn bb-btn-outline" onClick={more} disabled={busy}>{t.action.loadMore}</button></div> : <p className="cm-end">{t.feed.end}</p>}
    </div>
  );
}
