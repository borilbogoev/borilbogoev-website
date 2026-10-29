"use client";

import { useRef, useState } from "react";
import { api, message, type Category, type People, type Post } from "../lib/client";
import { POLL } from "../lib/constants";
import { usePolling } from "../hooks/use-polling";
import { t } from "../strings";
import { PostCard } from "./post-card";
import { PostComposer } from "./post-composer";

export type ComposerConfig = { maxImages: number; maxImageMb: number };

const EPOCH = "1970-01-01T00:00:00.000Z_0";

/** The feed: server-rendered first page, "load more", and a polite "N new posts" pill that never moves the page by itself. */
export function Feed({
  slug,
  communityId,
  meId,
  initial,
  initialPeople,
  initialNext,
  composer,
  categories,
  categoryId,
  sort,
  richHref,
}: {
  slug: string;
  communityId: number;
  meId: string;
  initial: Post[];
  initialPeople: People;
  initialNext: string | null;
  composer: ComposerConfig | null;
  /** Every category the viewer may use (the SuperAdmin also gets drafts). */
  categories: Category[];
  categoryId: number | null;
  sort: string;
  /** SuperAdmin only: where the rich post builder opens. */
  richHref: string;
}) {
  const [items, setItems] = useState(initial);
  const [people, setPeople] = useState(initialPeople);
  const [next, setNext] = useState(initialNext);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [fetching, setFetching] = useState(false);
  // The newest post this page has actually seen from the server. Own posts do not move it, so nobody else's post is skipped.
  const newest = useRef(initial.find((p) => !p.mine)?.cursor ?? initial[0]?.cursor ?? EPOCH);
  const top = useRef<HTMLDivElement>(null);

  usePolling(
    async (signal) => {
      const r = await api.feedUpdates(slug, newest.current, categoryId, signal);
      setPending(r.newCount);
    },
    { intervalMs: POLL.feed, key: `${slug}-${categoryId}` },
  );

  async function showNew() {
    setFetching(true);
    try {
      const r = await api.feed(slug, { after: newest.current, categoryId, sort });
      if (r.items.length) {
        newest.current = r.items.reduce((a, b) => (b.cursor > a ? b.cursor : a), newest.current);
        setItems((cur) => {
          const have = new Set(cur.map((p) => p.id));
          return [...r.items.filter((p) => !have.has(p.id)), ...cur];
        });
        setPeople((p) => ({ ...p, ...r.people }));
      }
      setPending(0);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(message(e));
    } finally {
      setFetching(false);
    }
  }

  async function more() {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const r = await api.feed(slug, { cursor: next, categoryId, sort });
      setItems((cur) => {
        const have = new Set(cur.map((p) => p.id));
        return [...cur, ...r.items.filter((p) => !have.has(p.id))];
      });
      setPeople((p) => ({ ...p, ...r.people }));
      setNext(r.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div ref={top} />
      <div className="cm-pill-wrap" aria-live="polite">
        {pending > 0 ? (
          <button type="button" className="cm-pill" onClick={showNew} disabled={fetching}>
            {t.feed.newPosts(pending)}
          </button>
        ) : null}
      </div>
      {composer ? (
        <PostComposer
          communityId={communityId}
          slug={slug}
          categories={categories.filter((c) => c.status === "published")}
          defaultCategoryId={categoryId}
          richHref={richHref}
          maxImages={composer.maxImages}
          maxImageMb={composer.maxImageMb}
          onCreated={(post, p) => {
            setItems((cur) => [post, ...cur.filter((x) => x.id !== post.id)]);
            setPeople((cur) => ({ ...cur, ...p }));
          }}
        />
      ) : null}
      {items.length === 0 ? (
        <div className="cm-empty">
          <h2>{t.feed.emptyTitle}</h2>
          <p>{t.feed.emptyText}</p>
        </div>
      ) : (
        <div className="cm-stack">
          {items.map((p) => (
            <PostCard key={p.id} post={p} people={people} slug={slug} communityId={communityId} meId={meId} categories={categories} onRemoved={(id) => setItems((cur) => cur.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}
      {loadingMore ? <div className="cm-skeleton cm-skeleton--card" aria-label={t.state.loading} /> : null}
      {error ? (
        <p className="cm-error" role="alert">
          {error}{" "}
          <button type="button" className="cm-link-btn" onClick={next ? more : showNew}>
            {t.action.retry}
          </button>
        </p>
      ) : null}
      {next ? (
        <div className="cm-more">
          <button type="button" className="bb-btn bb-btn-outline" onClick={more} disabled={loadingMore}>
            {t.action.loadMore}
          </button>
        </div>
      ) : items.length > 0 ? (
        <p className="cm-end">{t.feed.end}</p>
      ) : null}
    </div>
  );
}
