"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "../lib/client";
import { POLL } from "../lib/constants";
import { usePolling } from "../hooks/use-polling";
import { t } from "../strings";

const bell = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </svg>
);
const chat = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

/** Bell with the unread count. Polls every 30 s while the tab is visible. */
export function NotificationBell({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  usePolling(async (s) => setN((await api.unreadNotifications(s)).count), { intervalMs: POLL.bell });
  return (
    <Link href="/community/notifications" className="cm-navbtn" aria-label={n ? t.notifications.unread(n) : t.notifications.bell}>
      {bell}
      {n > 0 ? <span className="cm-badge" aria-hidden="true">{n > 99 ? "99+" : n}</span> : null}
    </Link>
  );
}

/** Messages link with a dot or count of conversations that have unread messages. */
export function MessagesBadge({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  usePolling(async (s) => setN((await api.unreadConversations(s)).count), { intervalMs: POLL.unread });
  return (
    <Link href="/community/messages" className="cm-navbtn" aria-label={n ? `${t.nav.messages}: ${t.chat.unread}` : t.nav.messages}>
      {chat}
      {n > 0 ? <span className="cm-badge" aria-hidden="true">{n > 99 ? "99+" : n}</span> : null}
    </Link>
  );
}
