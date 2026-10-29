"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/modules/account/components/ui";
import { del, get, message, newRequestId, post, type Message, type People, type Person } from "../lib/client";
import { LIMITS, POLL } from "../lib/constants";
import { usePolling } from "../hooks/use-polling";
import { t } from "../strings";
import { MentionText } from "./mention-text";
import { emptyMention, MentionTextarea, stored, type MentionValue } from "./mention-textarea";
import { RelativeTime } from "./relative-time";
import { ReportDialog } from "./report-dialog";
import { toast } from "./toast";

type Conv = { id: number; otherId: string; lastMessage: { body: string; mine: boolean; deleted: boolean; createdAt: string } | null; lastMessageAt: string | null; unread: boolean };

/** The conversation list. Server-rendered first, refreshed every 30 s while open. */
export function ConversationList({ initial, initialPeople }: { initial: Conv[]; initialPeople: People }) {
  const [items, setItems] = useState(initial);
  const [people, setPeople] = useState(initialPeople);
  usePolling(
    async (signal) => {
      const r = await get<{ items: Conv[]; people: People }>("/api/community/conversations", signal);
      setItems(r.items);
      setPeople((p) => ({ ...p, ...r.people }));
    },
    { intervalMs: POLL.conversations },
  );
  if (!items.length) {
    return (
      <div className="cm-empty">
        <h2>{t.chat.empty}</h2>
        <p>{t.chat.emptyText}</p>
      </div>
    );
  }
  return (
    <ul className="cm-list">
      {items.map((c) => {
        const who = people[c.otherId];
        return (
          <li key={c.id}>
            <Link href={`/community/messages/${c.id}`} className={`cm-notif${c.unread ? " is-unread" : ""}`}>
              <Avatar name={who?.name ?? "?"} url={who?.avatarUrl} size={44} />
              <span className="cm-notif__body">
                <strong>{who?.name ?? "Member"}</strong>
                <span className="cm-muted cm-clip">
                  {c.lastMessage ? (c.lastMessage.deleted ? t.chat.deleted : `${c.lastMessage.mine ? `${t.chat.you}: ` : ""}${c.lastMessage.body}`) : ""}
                </span>
              </span>
              <span className="cm-muted cm-notif__time">{c.lastMessageAt ? <RelativeTime iso={c.lastMessageAt} /> : null}</span>
              {c.unread ? <span className="cm-dot" aria-label={t.chat.unread} /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

type Row = Message & { pending?: boolean };

export function ConversationThread({ conversationId, other, me, initial, initialPeople, initialNext, canSend }: { conversationId: number; other: Person; me: Person; initial: Message[]; initialPeople: People; initialNext: string | null; canSend: boolean }) {
  const [items, setItems] = useState<Row[]>(initial);
  const [people, setPeople] = useState<People>({ ...initialPeople, [me.id]: me, [other.id]: other });
  const [next, setNext] = useState(initialNext);
  const [value, setValue] = useState<MentionValue>(emptyMention());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<number | null>(null);
  const requestId = useRef(newRequestId());
  const seen = useRef(initial.at(-1)?.cursor ?? null);
  const bottom = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const markRead = () => post(`/api/community/conversations/${conversationId}/read`).catch(() => {});
  useEffect(() => {
    void markRead();
    bottom.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePolling(
    async (signal) => {
      const p = new URLSearchParams();
      if (seen.current) p.set("after", seen.current);
      else p.set("after", "1970-01-01T00:00:00.000Z_0");
      const r = await get<{ items: Message[]; people: People }>(`/api/community/conversations/${conversationId}/messages?${p}`, signal);
      if (!r.items.length) return;
      seen.current = r.items.at(-1)!.cursor;
      setPeople((cur) => ({ ...cur, ...r.people }));
      setItems((cur) => {
        const have = new Set(cur.map((m) => m.id));
        const add = r.items.filter((m) => !have.has(m.id));
        return add.length ? [...cur, ...add] : cur;
      });
      if (r.items.some((m) => !m.mine)) void markRead(); // the thread is open: what arrives is read
      requestAnimationFrame(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    },
    { intervalMs: POLL.thread, key: conversationId },
  );

  async function older() {
    if (!next) return;
    try {
      const r = await get<{ items: Message[]; people: People; nextCursor: string | null }>(`/api/community/conversations/${conversationId}/messages?cursor=${encodeURIComponent(next)}`);
      setItems((cur) => [...r.items, ...cur]);
      setPeople((p) => ({ ...p, ...r.people }));
      setNext(r.nextCursor);
    } catch (e) {
      setError(message(e));
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const draft = value;
    if (busy || !draft.text.trim()) return;
    setBusy(true);
    setError("");
    const body = stored(draft);
    const tempId = -Date.now();
    setItems((cur) => [...cur, { id: tempId, conversationId, senderId: me.id, body, deleted: false, createdAt: new Date().toISOString(), cursor: "", mine: true, pending: true }]);
    setPeople((p) => ({ ...p, ...Object.fromEntries(draft.picks.map((k) => [k.userId, { id: k.userId, name: k.name, username: "", avatarUrl: "" }])) }));
    setValue(emptyMention());
    requestAnimationFrame(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    try {
      const res = await post<{ item: Message }>(`/api/community/conversations/${conversationId}/messages`, { body, requestId: requestId.current });
      setItems((cur) => {
        const without = cur.filter((m) => m.id !== tempId);
        return without.some((m) => m.id === res.item.id) ? without : [...without, res.item];
      });
      requestId.current = newRequestId();
    } catch (err) {
      setItems((cur) => cur.filter((m) => m.id !== tempId));
      setValue(draft);
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await del(`/api/community/messages/${id}`);
      setItems((cur) => cur.map((m) => (m.id === id ? { ...m, deleted: true, body: "" } : m)));
    } catch (e) {
      toast(message(e), "error");
    }
  }

  return (
    <div className="cm-thread">
      <header className="cm-thread__head">
        <Link href="/community/messages" className="cm-link-btn">← {t.chat.back}</Link>
        <Link href={`/community/u/${other.id}`} className="cm-author">
          <Avatar name={other.name} url={other.avatarUrl} size={36} />
          <strong>{other.name}</strong>
        </Link>
      </header>
      <div className="cm-thread__list" ref={list} role="log" aria-live="polite" aria-label="Messages">
        {next ? <div className="cm-more"><button type="button" className="bb-btn bb-btn-outline cm-btn-sm" onClick={older}>{t.action.loadMore}</button></div> : null}
        {items.length === 0 ? <p className="cm-muted cm-center">{t.chat.noMessages}</p> : null}
        {items.map((m) => (
          <div key={m.id} className={`cm-msg${m.mine ? " is-mine" : ""}${m.pending ? " is-pending" : ""}`}>
            <div className="cm-msg__bubble">
              {m.deleted ? <em className="cm-muted">{t.chat.deleted}</em> : <MentionText body={m.body} people={people} />}
            </div>
            <div className="cm-msg__meta cm-muted">
              <RelativeTime iso={m.createdAt} />
              {m.mine && !m.deleted && !m.pending ? <button type="button" className="cm-link-btn" onClick={() => remove(m.id)}>{t.action.delete}</button> : null}
              {!m.mine && !m.deleted ? <button type="button" className="cm-link-btn" onClick={() => setReport(m.id)}>{t.action.report}</button> : null}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {canSend ? (
        <form className="cm-thread__form" onSubmit={send}>
          <MentionTextarea value={value} onChange={setValue} label="Write a message" placeholder={t.composer.messagePlaceholder} maxLength={LIMITS.messageBody} rows={2} onSubmitShortcut={() => void send()} />
          <button type="submit" className="bb-btn bb-btn-primary" disabled={busy || !value.text.trim()}>{busy ? t.action.sending : t.action.send}</button>
        </form>
      ) : null}
      {error ? <p className="cm-error" role="alert">{error}</p> : null}
      <ReportDialog target={report ? { type: "message", id: report } : null} onClose={() => setReport(null)} />
    </div>
  );
}
