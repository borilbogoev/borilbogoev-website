import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS } from "../lib/constants";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { cleanBody } from "../lib/text";
import { db, forbidden, invalid, isUniqueViolation, notFound, run, intArray } from "./core";
import { communityState, memberState, type Scope } from "./context";
import { dropMentionsFor, resolveMentions, writeMentions } from "./mentions";
import { dropNotificationsFor } from "./notifications";
import { canEditOwn, canModerateContent, canPost, type Decision } from "./permissions";
import { loadPeopleFor, type People, type Person } from "./people";
import { checkRate } from "./rate";

const { communityPosts: P, communityPostMedia: M, users } = schema;

export type MediaDTO = { id: number; url: string; width: number; height: number; alt: string };

export type PostDTO = {
  id: number;
  communityId: number;
  author: Person;
  body: string;
  createdAt: string;
  editedAt: string | null;
  commentCount: number;
  status: "published" | "hidden_by_mod";
  media: MediaDTO[];
  cursor: string;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};

export type PostRow = typeof P.$inferSelect;

export const unwrap = (d: Decision) => {
  if (!d.ok) throw d.code === "not_found" ? notFound() : forbidden(d.message);
};

/** Flags for the post as the viewer may use it inside one community. */
export function postFlags(scope: Scope, authorId: string, status: string) {
  const mine = authorId === scope.viewer.user.id;
  const a = scope.viewer.actor;
  const m = memberState(scope.membership);
  const c = communityState(scope.community);
  const own = mine && canEditOwn(a, m, c, scope.settings, authorId).ok;
  const mod = !mine && canModerateContent(a, m, c).ok;
  return { mine, canEdit: own && status === "published", canDelete: own || mod || (a.superAdmin && mine), canModerate: mod };
}

/** Media rows for a set of posts, grouped by post, in order. One query. */
export async function mediaFor(postIds: number[]): Promise<Map<number, MediaDTO[]>> {
  const out = new Map<number, MediaDTO[]>();
  if (!postIds.length) return out;
  const rows = await db().select().from(M).where(inArray(M.postId, postIds)).orderBy(asc(M.postId), asc(M.position));
  for (const r of rows) {
    const list = out.get(r.postId as number) ?? [];
    list.push({ id: r.id, url: r.url, width: r.width, height: r.height, alt: r.alt ?? "" });
    out.set(r.postId as number, list);
  }
  return out;
}

type Joined = { post: PostRow; author: { id: string; name: string; username: string | null; avatarUrl: string | null } };

async function toDTOs(scope: Scope, rows: Joined[]): Promise<{ items: PostDTO[]; people: People }> {
  const [media, people] = await Promise.all([mediaFor(rows.map((r) => r.post.id)), loadPeopleFor(rows.map((r) => r.author.id), rows.map((r) => r.post.body))]);
  const items = rows.map(({ post }) => ({
    id: post.id,
    communityId: post.communityId,
    author: people[post.authorId],
    body: post.body,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt ? post.editedAt.toISOString() : null,
    commentCount: post.commentCount,
    status: post.status as PostDTO["status"],
    media: media.get(post.id) ?? [],
    cursor: encodeCursor(post),
    ...postFlags(scope, post.authorId, post.status),
  }));
  return { items, people };
}

const visibleToViewer = (scope: Scope) => or(eq(P.status, "published"), and(eq(P.status, "hidden_by_mod"), eq(P.authorId, scope.viewer.user.id)));

/** One page of the feed, newest first. Posts, authors and media come from three queries. */
export async function listFeed(scope: Scope, opts: { cursor?: string | null; after?: string | null }) {
  const after = decodeCursor(opts.after);
  const cur = decodeCursor(opts.cursor);
  const limit = after ? 50 : LIMITS.postPage;
  const rows = await db()
    .select({ post: P, author: { id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl } })
    .from(P)
    .innerJoin(users, eq(users.id, P.authorId))
    .where(
      and(
        eq(P.communityId, scope.community.id),
        visibleToViewer(scope),
        after ? or(gt(P.createdAt, after.at), and(eq(P.createdAt, after.at), gt(P.id, after.id))) : undefined,
        !after && cur ? or(lt(P.createdAt, cur.at), and(eq(P.createdAt, cur.at), lt(P.id, cur.id))) : undefined,
      ),
    )
    .orderBy(desc(P.createdAt), desc(P.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const { items, people } = await toDTOs(scope, page);
  return { items, people, nextCursor: !after && rows.length > limit ? items[items.length - 1].cursor : null };
}

/** Cheap poll: how many posts by other people are newer than the cursor. One indexed count. */
export async function feedUpdates(scope: Scope, afterRaw: string | null) {
  const after = decodeCursor(afterRaw);
  if (!after) return { newCount: 0, newestCursor: null as string | null };
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int`, at: sql<string | null>`max(${P.createdAt})`, id: sql<number | null>`max(${P.id})` })
    .from(P)
    .where(and(eq(P.communityId, scope.community.id), eq(P.status, "published"), ne(P.authorId, scope.viewer.user.id), or(gt(P.createdAt, after.at), and(eq(P.createdAt, after.at), gt(P.id, after.id)))));
  if (!r?.n) return { newCount: 0, newestCursor: null };
  // The newest row, not max(id): ordering is by (created_at, id).
  const [top] = await db().select({ id: P.id, createdAt: P.createdAt }).from(P).where(and(eq(P.communityId, scope.community.id), eq(P.status, "published"), ne(P.authorId, scope.viewer.user.id))).orderBy(desc(P.createdAt), desc(P.id)).limit(1);
  return { newCount: r.n, newestCursor: top ? encodeCursor(top) : null };
}

export async function getPostRow(id: number): Promise<PostRow | null> {
  const [p] = await db().select().from(P).where(eq(P.id, id)).limit(1);
  return p ?? null;
}

/** A single post for its page. Deleted posts and other people's hidden posts are not found. */
export async function getPost(scope: Scope, id: number): Promise<{ item: PostDTO; people: People } | null> {
  const [row] = await db()
    .select({ post: P, author: { id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl } })
    .from(P)
    .innerJoin(users, eq(users.id, P.authorId))
    .where(and(eq(P.id, id), eq(P.communityId, scope.community.id), visibleToViewer(scope)))
    .limit(1);
  if (!row) return null;
  const { items, people } = await toDTOs(scope, [row]);
  return { item: items[0], people };
}

export type PostInput = { body: unknown; mediaIds?: number[]; alts?: Record<string, unknown>; requestId?: string | null };

export async function createPost(scope: Scope, input: PostInput): Promise<{ item: PostDTO; people: People; duplicate: boolean }> {
  const { viewer, community, settings } = scope;
  unwrap(canPost(viewer.actor, memberState(scope.membership), communityState(community), settings));
  const body = cleanBody(input.body);
  const mediaIds = [...new Set(input.mediaIds ?? [])];
  if (body.length > LIMITS.postBody) throw invalid(`That is too long. The limit is ${LIMITS.postBody} characters.`);
  if (!body && !mediaIds.length) throw invalid("Write something or add an image.");
  if (mediaIds.length > settings.maxImagesPerPost) throw invalid(`You can add up to ${settings.maxImagesPerPost} images.`);
  const requestId = typeof input.requestId === "string" && input.requestId.length <= 64 ? input.requestId : null;

  if (requestId) {
    const [dup] = await db().select({ id: P.id }).from(P).where(and(eq(P.authorId, viewer.user.id), eq(P.requestId, requestId))).limit(1);
    if (dup) return { ...(await getPost(scope, dup.id))!, duplicate: true };
  }
  await checkRate(viewer, "post");
  if (mediaIds.length) {
    const own = await db().select({ id: M.id }).from(M).where(and(inArray(M.id, mediaIds), eq(M.uploaderId, viewer.user.id), isNull(M.postId)));
    if (own.length !== mediaIds.length) throw invalid("One of the images is not available. Upload it again.");
  }

  for (const mid of mediaIds) {
    const alt = input.alts?.[String(mid)];
    if (typeof alt === "string") await db().update(M).set({ alt: alt.trim().slice(0, 300) || null }).where(and(eq(M.id, mid), eq(M.uploaderId, viewer.user.id), isNull(M.postId)));
  }
  const mentions = await resolveMentions({ body, authorId: viewer.user.id, communityId: community.id });
  const now = new Date();
  let id: number;
  try {
    // One statement: the post and the attachment of its images succeed or fail together.
    const [row] = await run<{ id: number }>(sql`
      WITH p AS (
        INSERT INTO community_posts (community_id, author_id, body, request_id, created_at, updated_at)
        VALUES (${community.id}, ${viewer.user.id}, ${mentions.body}, ${requestId}, ${now}, ${now}) RETURNING id
      ), m AS (
        UPDATE community_post_media SET post_id = (SELECT id FROM p), position = o.pos - 1
        FROM unnest(${intArray(mediaIds)}) WITH ORDINALITY AS o(mid, pos)
        WHERE community_post_media.id = o.mid AND community_post_media.uploader_id = ${viewer.user.id} AND community_post_media.post_id IS NULL
        RETURNING 1
      )
      SELECT id FROM p`);
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e) && requestId) {
      const [dup] = await db().select({ id: P.id }).from(P).where(and(eq(P.authorId, viewer.user.id), eq(P.requestId, requestId))).limit(1);
      if (dup) return { ...(await getPost(scope, dup.id))!, duplicate: true };
    }
    throw e;
  }
  await writeMentions({ sourceType: "post", sourceId: id, communityId: community.id, authorId: viewer.user.id, ids: mentions.ids, notify: { postId: id } });
  return { ...(await getPost(scope, id))!, duplicate: false };
}

export async function editPost(scope: Scope, post: PostRow, bodyRaw: unknown) {
  const { viewer, community, settings } = scope;
  unwrap(canEditOwn(viewer.actor, memberState(scope.membership), communityState(community), settings, post.authorId));
  if (post.status !== "published") throw notFound();
  const body = cleanBody(bodyRaw);
  if (body.length > LIMITS.postBody) throw invalid(`That is too long. The limit is ${LIMITS.postBody} characters.`);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(M).where(eq(M.postId, post.id));
  if (!body && !n) throw invalid("Write something or add an image.");
  const mentions = await resolveMentions({ body, authorId: viewer.user.id, communityId: community.id });
  const now = new Date();
  await db().update(P).set({ body: mentions.body, editedAt: now, updatedAt: now }).where(eq(P.id, post.id));
  await writeMentions({ sourceType: "post", sourceId: post.id, communityId: community.id, authorId: viewer.user.id, ids: mentions.ids, notify: { postId: post.id } });
  return (await getPost(scope, post.id))!;
}

/** Soft delete (own post, or a moderator's delete) and moderator hide / unhide. Comments stay but are no longer listed. */
export async function setPostStatus(scope: Scope, post: PostRow, status: "deleted" | "hidden_by_mod" | "published") {
  const { viewer, community, settings } = scope;
  const a = viewer.actor;
  const m = memberState(scope.membership);
  const c = communityState(community);
  const mine = post.authorId === a.id;
  if (status === "published") unwrap(canModerateContent(a, m, c));
  else if (status === "hidden_by_mod") unwrap(canModerateContent(a, m, c));
  else unwrap(mine ? canEditOwn(a, m, c, settings, post.authorId) : canModerateContent(a, m, c));
  if (post.status === "deleted") throw notFound();
  const now = new Date();
  await db().update(P).set({ status, updatedAt: now, deletedAt: status === "deleted" ? now : null }).where(eq(P.id, post.id));
  if (status !== "published") {
    await dropNotificationsFor({ postIds: [post.id] });
    await dropMentionsFor("post", [post.id]);
  }
}
