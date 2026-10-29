import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS } from "../lib/constants";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { snippet } from "../lib/text";
import { db } from "./core";
import { loadPeople, type People } from "./people";

const { communityNotifications: n, communityPosts, communityComments, communities } = schema;

export type NotificationDTO = {
  ids: number[];
  type: "mention" | "post_comment";
  actorId: string;
  count: number;
  read: boolean;
  createdAt: string;
  communitySlug: string;
  communityName: string;
  postId: number;
  commentId: number | null;
  snippet: string;
  href: string;
  cursor: string;
};

export async function unreadCount(userId: string): Promise<number> {
  const [r] = await db().select({ c: sql<number>`count(*)::int` }).from(n).where(and(eq(n.userId, userId), isNull(n.readAt)));
  return r?.c ?? 0;
}

export async function listNotifications(userId: string, rawCursor?: string | null): Promise<{ items: NotificationDTO[]; nextCursor: string | null; people: People }> {
  const cur = decodeCursor(rawCursor);
  const rows = await db()
    .select({ n, slug: communities.slug, cname: communities.name, postBody: communityPosts.body, commentBody: communityComments.body })
    .from(n)
    .innerJoin(communities, eq(communities.id, n.communityId))
    .innerJoin(communityPosts, eq(communityPosts.id, n.postId))
    .leftJoin(communityComments, eq(communityComments.id, n.commentId))
    .where(
      and(
        eq(n.userId, userId),
        eq(communityPosts.status, "published"),
        or(isNull(n.commentId), eq(communityComments.status, "published")),
        cur ? or(lt(n.createdAt, cur.at), and(eq(n.createdAt, cur.at), lt(n.id, cur.id))) : undefined,
      ),
    )
    .orderBy(desc(n.createdAt), desc(n.id))
    .limit(LIMITS.notificationPage + 1);
  const page = rows.slice(0, LIMITS.notificationPage);
  const nextCursor = rows.length > LIMITS.notificationPage ? encodeCursor(page[page.length - 1].n) : null;

  // Collapse unread comments on the same post: "3 new comments on your post".
  const items: NotificationDTO[] = [];
  const byPost = new Map<number, NotificationDTO>();
  for (const r of page) {
    const base: NotificationDTO = {
      ids: [r.n.id],
      type: r.n.type as NotificationDTO["type"],
      actorId: r.n.actorId,
      count: 1,
      read: !!r.n.readAt,
      createdAt: r.n.createdAt.toISOString(),
      communitySlug: r.slug,
      communityName: r.cname,
      postId: r.n.postId,
      commentId: r.n.commentId,
      snippet: snippet(r.commentBody ?? r.postBody, 120),
      href: `/community/${r.slug}/post/${r.n.postId}${r.n.commentId ? `#comment-${r.n.commentId}` : ""}`,
      cursor: encodeCursor(r.n),
    };
    const group = r.n.type === "post_comment" && !r.n.readAt ? byPost.get(r.n.postId) : undefined;
    if (group) {
      group.ids.push(r.n.id);
      group.count += 1;
    } else {
      items.push(base);
      if (r.n.type === "post_comment" && !r.n.readAt) byPost.set(r.n.postId, base);
    }
  }
  return { items, nextCursor, people: await loadPeople(items.map((i) => i.actorId)) };
}

export async function markRead(userId: string, input: { ids?: number[]; all?: boolean }): Promise<void> {
  const now = new Date();
  if (input.all) {
    await db().update(n).set({ readAt: now }).where(and(eq(n.userId, userId), isNull(n.readAt)));
  } else if (input.ids?.length) {
    await db().update(n).set({ readAt: now }).where(and(eq(n.userId, userId), isNull(n.readAt), inArray(n.id, input.ids.slice(0, 200))));
  }
}

/** Content that is hidden or deleted no longer notifies anyone. */
export async function dropNotificationsFor(input: { postIds?: number[]; commentIds?: number[] }) {
  if (input.postIds?.length) await db().delete(n).where(inArray(n.postId, input.postIds));
  if (input.commentIds?.length) await db().delete(n).where(inArray(n.commentId, input.commentIds));
}
