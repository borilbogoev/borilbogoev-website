"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/modules/account/components/ui";
import { get, message, post, type People } from "../lib/client";
import { t } from "../strings";
import { RelativeTime } from "./relative-time";

type Item = {
  ids: number[]; type: "mention" | "post_comment"; actorId: string; count: number; read: boolean; createdAt: string; communityName: string; snippet: string; href: string; cursor: string;
};

export function NotificationList({ initial, initialPeople, initialNext }: { initial: Item[]; initialPeople: People; initialNext: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [people, setPeople] = useState(initialPeople);
  const [next, setNext] = useState(initialNext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open(i: Item) {
    if (!i.read) {
      setItems((cur) => cur.map((x) => (x === i ? { ...x, read: true } : x)));
      post("/api/community/notifications/read", { ids: i.ids }).catch(() => {});
    }
    router.push(i.href);
  }
  async function readAll() {
    try {
      await post("/api/community/notifications/read", { all: true });
      setItems((cur) => cur.map((x) => ({ ...x, read: true })));
      router.refresh();
    } catch (e) {
      setError(message(e));
    }
  }
  async function more() {
    if (!next) return;
    setBusy(true);
    try {
      const r = await get<{ items: Item[]; people: People; nextCursor: string | null }>(`/api/community/notifications?cursor=${encodeURIComponent(next)}`);
      setItems((cur) => [...cur, ...r.items]);
      setPeople((p) => ({ ...p, ...r.people }));
      setNext(r.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <div className="cm-empty">
        <h2>{t.notifications.empty}</h2>
        <p>{t.notifications.emptyText}</p>
      </div>
    );
  }
  return (
    <div>
      <div className="cm-toolbar">
        <button type="button" className="bb-btn bb-btn-outline cm-btn-sm" onClick={readAll} disabled={!items.some((i) => !i.read)}>
          {t.action.markAllRead}
        </button>
      </div>
      <ul className="cm-list">
        {items.map((i) => {
          const who = people[i.actorId];
          return (
            <li key={i.ids[0]}>
              <button type="button" className={`cm-notif${i.read ? "" : " is-unread"}`} onClick={() => open(i)}>
                <Avatar name={who?.name ?? "?"} url={who?.avatarUrl} size={40} />
                <span className="cm-notif__body">
                  <strong>{i.type === "mention" ? t.notifications.mention(who?.name ?? "Someone") : t.notifications.comment(who?.name ?? "Someone", i.count)}</strong>
                  <span className="cm-muted">{i.snippet}</span>
                  <span className="cm-muted">
                    {i.communityName} · <RelativeTime iso={i.createdAt} />
                  </span>
                </span>
                {i.read ? null : <span className="cm-dot" aria-label="Unread" />}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p className="cm-error" role="alert">{error}</p> : null}
      {next ? <div className="cm-more"><button type="button" className="bb-btn bb-btn-outline" onClick={more} disabled={busy}>{t.action.loadMore}</button></div> : <p className="cm-end">{t.feed.end}</p>}
    </div>
  );
}
