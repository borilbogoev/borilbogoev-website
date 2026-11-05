"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Comment, type People, type Person } from "../lib/client";
import { t } from "../strings";
import { CommentSection } from "./comments";
import "./community.css";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; me: Person | null; suspended: boolean; items: Comment[]; people: People; next: string | null; count: number };

/**
 * Comments under a post of a public community. The page around it is static, so everything personal happens here, in the browser:
 * who is looking (`/api/public/community/me`), then the comments. Visitors read; signed-in people also comment (a closed
 * community or a paused or suspended account says why instead of showing the box).
 */
export function PublicComments({ postId, communityId, path, locked, initialCount, archived }: { postId: number; communityId: number; path: string; locked: boolean; initialCount: number; archived: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const who = (await fetch("/api/public/community/me", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : { signedIn: false }))) as { signedIn: boolean; suspended?: boolean; me?: Person };
        const page = who.signedIn ? await api.comments(postId) : await api.publicComments(postId, {});
        if (live) setState({ kind: "ready", me: who.signedIn ? (who.me ?? null) : null, suspended: !!who.suspended, items: page.items, people: page.people, next: page.nextCursor, count: "commentCount" in page ? (page as { commentCount: number }).commentCount : initialCount });
      } catch {
        if (live) setState({ kind: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, [postId, initialCount]);

  if (state.kind === "loading") return <p className="cm-muted" aria-live="polite">Loading comments...</p>;
  if (state.kind === "error") return <p className="cm-error" role="alert">Comments could not be loaded. Reload the page to try again.</p>;

  const signedIn = !!state.me;
  const reason = locked ? t.rich.commentsOff : archived ? t.community.archivedBanner : state.suspended ? t.community.suspendedBanner : "";
  return (
    <div className="cm-inline">
      <CommentSection
        key={signedIn ? "member" : "visitor"}
        postId={postId}
        communityId={communityId}
        me={state.me ?? { id: "", name: "", username: "", avatarUrl: "" }}
        initial={state.items}
        initialPeople={state.people}
        initialNext={state.next}
        initialCount={state.count}
        canComment={signedIn && !reason}
        blockedReason={reason}
        anonymous={!signedIn}
      />
      {!signedIn && !locked ? (
        <p className="cm-note">
          <Link href={`/account/login?next=${encodeURIComponent(path)}`} className="cm-link">Sign in</Link> or create a free account to comment.
        </p>
      ) : null}
    </div>
  );
}
