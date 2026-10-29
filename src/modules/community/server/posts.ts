import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS, SORT_RULES, type Sort, type SortRule } from "../lib/constants";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { coverOf, highlightsOf, type Highlight, type RichBlock } from "../lib/rich";
import { cleanBody } from "../lib/text";
import { db, forbidden, invalid, isUniqueViolation, notFound, run, intArray, unwrap } from "./core";
import { getCategory } from "./categories";
import { communityState, memberState, type Scope } from "./context";
import { dropMentionsFor, resolveMentions, writeMentions } from "./mentions";
import { dropNotificationsFor } from "./notifications";
import { canChangeCategory, canEditAnyPost, canEditOwn, canLockComments, canModerateContent, canPin, canPost } from "./permissions";
import { loadPeopleFor, type People, type Person } from "./people";
import { checkRate } from "./rate";

export { unwrap };

const { communityPosts: P, communityPostMedia: M, communityPostReads: Reads, users } = schema;

export type MediaDTO = { id: number; url: string; width: number; height: number; alt: string };

export type PostDTO = {
  id: number;
  communityId: number;
  kind: "post" | "rich";
  title: string;
  author: Person;
  body: string;
  createdAt: string;
  editedAt: string | null;
  commentCount: number;
  likeCount: number;
  liked: boolean;
  status: "published" | "hidden_by_mod";
  media: MediaDTO[];
  categoryId: number | null;
  pinned: boolean;
  commentsLocked: boolean;
  cover: string;
  highlights: Highlight[];
  /** Rich posts, post page only: the blocks to render. */
  blocks?: RichBlock[];
  cursor: string;
  sortCursor: string;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
  canPin: boolean;
  canLock: boolean;
  canCategory: boolean;
  canBan: boolean;
  builderHref: string;
};

export type PostRow = typeof P.$inferSelect;

/** Flags for the post as the viewer may use it inside one community. */
export function postFlags(scope: Scope, post: { authorId: string; status: string; kind: string; id: number }) {
  const mine = post.authorId === scope.viewer.user.id;
  const a = scope.viewer.actor;
  const m = memberState(scope.membership);
  const c = communityState(scope.community);
  const own = mine && canEditOwn(a, m, c, scope.settings, post.authorId).ok;
  const mod = !mine && canModerateContent(a, m, c).ok;
  const rich = post.kind === "rich";
  const live = post.status === "published";
  return {
    mine,
    canEdit: !rich && ((own && live) || (canEditAnyPost(a).ok && post.status !== "deleted")),
    canDelete: own || mod || (a.superAdmin && mine),
    canModerate: mod,
    canPin: canPin(a).ok && live,
    canLock: canLockComments(a).ok,
    canCategory: canChangeCategory(a, m, c, scope.settings, post.authorId).ok && post.status !== "deleted",
    canBan: a.superAdmin && !mine,
    builderHref: rich && a.superAdmin ? `/admin/communities/posts/${post.id}` : "",
  };
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

type Joined = { post: PostRow; liked: boolean; author: { id: string; name: string; username: string | null; avatarUrl: string | null } };

const asBlocks = (v: unknown): RichBlock[] => (Array.isArray(v) ? (v as RichBlock[]) : []);

/** The cursor a post has under one sort rule. */
export function sortCursorOf(post: PostRow, sort: Sort): string {
  if (sort === "default") return `${post.lastActivityAt.toISOString()}_${post.id}`;
  if (sort === "top") return `${post.likeCount}~${post.createdAt.toISOString()}_${post.id}`;
  return encodeCursor(post);
}

async function toDTOs(scope: Scope, rows: Joined[], sort: Sort = "new", withBlocks = false): Promise<{ items: PostDTO[]; people: People }> {
  const [media, people] = await Promise.all([mediaFor(rows.map((r) => r.post.id)), loadPeopleFor(rows.map((r) => r.author.id), rows.map((r) => r.post.body))]);
  const items = rows.map(({ post, liked }): PostDTO => {
    const blocks = asBlocks(post.blocks);
    return {
      id: post.id,
      communityId: post.communityId,
      kind: post.kind === "rich" ? "rich" : "post",
      title: post.title ?? "",
      author: people[post.authorId],
      body: post.body,
      createdAt: post.createdAt.toISOString(),
      editedAt: post.editedAt ? post.editedAt.toISOString() : null,
      commentCount: post.commentCount,
      likeCount: post.likeCount,
      liked: !!liked,
      status: post.status === "hidden_by_mod" ? "hidden_by_mod" : "published",
      media: media.get(post.id) ?? [],
      categoryId: post.categoryId,
      pinned: !!post.pinnedAt,
      commentsLocked: post.commentsLocked,
      cover: post.kind === "rich" ? coverOf(blocks) : "",
      highlights: post.kind === "rich" ? highlightsOf(blocks) : [],
      ...(withBlocks && post.kind === "rich" ? { blocks } : {}),
      cursor: encodeCursor(post),
      sortCursor: sortCursorOf(post, sort),
      ...postFlags(scope, post),
    };
  });
  return { items, people };
}

/** Posts joined with their author and the viewer's like, as one query. */
function baseSelect(scope: Scope) {
  return db()
    .select({
      post: P,
      liked: sql<boolean>`exists (select 1 from community_likes l where l.user_id = ${scope.viewer.user.id} and l.target_type = 'post' and l.target_id = ${P.id})`,
      author: { id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl },
    })
    .from(P)
    .innerJoin(users, eq(users.id, P.authorId));
}

const visibleToViewer = (scope: Scope) => or(eq(P.status, "published"), and(eq(P.status, "hidden_by_mod"), eq(P.authorId, scope.viewer.user.id)));

function decodeTop(raw: string | null | undefined): { likes: number; at: Date; id: number } | null {
  if (!raw) return null;
  const i = raw.indexOf("~");
  if (i < 1) return null;
  const likes = Number(raw.slice(0, i));
  const c = decodeCursor(raw.slice(i + 1));
  return Number.isInteger(likes) && c ? { likes, at: c.at, id: c.id } : null;
}

export type FeedOptions = { sort?: Sort; categoryId?: number | null; cursor?: string | null; after?: string | null };

/** The sort rule that applies when the viewer has not picked one: the category's, or the community's for "All". */
export async function effectiveSort(scope: Scope, categoryId: number | null | undefined, picked?: string | null): Promise<Sort> {
  if (picked && (["default", "new", "top", "unread"] as string[]).includes(picked)) return picked as Sort;
  if (categoryId) {
    const c = await getCategory(categoryId);
    if (c) return c.sortRule;
  }
  const rule = scope.community.defaultSort;
  return (SORT_RULES as readonly string[]).includes(rule) ? (rule as SortRule) : "default";
}

/**
 * One page of the feed. Pinned posts come first on the first page whatever the sort; the rest follow the sort.
 * Posts, authors and the viewer's likes come from one query, media from a second, people from a third.
 */
export async function listFeed(scope: Scope, opts: FeedOptions) {
  const sort: Sort = opts.sort ?? "new";
  const after = decodeCursor(opts.after);
  const limit = after ? 50 : LIMITS.postPage;
  const me = scope.viewer.user.id;
  const inCategory = opts.categoryId ? eq(P.categoryId, opts.categoryId) : undefined;
  const base = and(eq(P.communityId, scope.community.id), visibleToViewer(scope), inCategory);

  let pinned: Joined[] = [];
  const firstPage = !opts.cursor && !after;
  if (firstPage && sort !== "unread") {
    pinned = await baseSelect(scope).where(and(base, sql`${P.pinnedAt} is not null`)).orderBy(desc(P.pinnedAt), desc(P.id)).limit(10);
  }

  let cursorWhere: SQL | undefined;
  if (after) cursorWhere = or(gt(P.createdAt, after.at), and(eq(P.createdAt, after.at), gt(P.id, after.id)));
  else if (opts.cursor) {
    if (sort === "top") {
      const c = decodeTop(opts.cursor);
      if (c) cursorWhere = or(lt(P.likeCount, c.likes), and(eq(P.likeCount, c.likes), or(lt(P.createdAt, c.at), and(eq(P.createdAt, c.at), lt(P.id, c.id)))));
    } else {
      const c = decodeCursor(opts.cursor);
      const col = sort === "default" ? P.lastActivityAt : P.createdAt;
      if (c) cursorWhere = or(lt(col, c.at), and(eq(col, c.at), lt(P.id, c.id)));
    }
  }
  const unread = sort === "unread" ? sql`${P.authorId} <> ${me} and not exists (select 1 from community_post_reads r where r.user_id = ${me} and r.post_id = ${P.id})` : undefined;
  const notPinned = !after && sort !== "unread" ? isNull(P.pinnedAt) : undefined;
  const order = sort === "default" ? [desc(P.lastActivityAt), desc(P.id)] : sort === "top" ? [desc(P.likeCount), desc(P.createdAt), desc(P.id)] : [desc(P.createdAt), desc(P.id)];

  const rows = await baseSelect(scope).where(and(base, cursorWhere, unread, notPinned)).orderBy(...order).limit(limit + 1);
  const page = rows.slice(0, limit);
  const { items, people } = await toDTOs(scope, [...pinned, ...page], sort);
  const last = page.length ? items[items.length - 1] : null;
  return { items, people, nextCursor: !after && rows.length > limit && last ? last.sortCursor : null };
}

/** Cheap poll: how many posts by other people are newer than the cursor. One indexed count. */
export async function feedUpdates(scope: Scope, afterRaw: string | null, categoryId?: number | null) {
  const after = decodeCursor(afterRaw);
  if (!after) return { newCount: 0, newestCursor: null as string | null };
  const where = and(
    eq(P.communityId, scope.community.id),
    eq(P.status, "published"),
    ne(P.authorId, scope.viewer.user.id),
    categoryId ? eq(P.categoryId, categoryId) : undefined,
    or(gt(P.createdAt, after.at), and(eq(P.createdAt, after.at), gt(P.id, after.id))),
  );
  const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(P).where(where);
  if (!r?.n) return { newCount: 0, newestCursor: null };
  const [top] = await db().select({ id: P.id, createdAt: P.createdAt }).from(P).where(where).orderBy(desc(P.createdAt), desc(P.id)).limit(1);
  return { newCount: r.n, newestCursor: top ? encodeCursor(top) : null };
}

export async function getPostRow(id: number): Promise<PostRow | null> {
  const [p] = await db().select().from(P).where(eq(P.id, id)).limit(1);
  return p ?? null;
}

/**
 * A single post for its page. Deleted posts and other people's hidden posts are not found.
 * The SuperAdmin may also open a draft (for the builder's preview).
 */
export async function getPost(scope: Scope, id: number): Promise<{ item: PostDTO; people: People } | null> {
  const draftOk = scope.viewer.actor.superAdmin ? eq(P.status, "draft") : undefined;
  const [row] = await baseSelect(scope).where(and(eq(P.id, id), eq(P.communityId, scope.community.id), or(visibleToViewer(scope), draftOk))).limit(1);
  if (!row) return null;
  const { items, people } = await toDTOs(scope, [row], "new", true);
  return { item: items[0], people };
}

/** Records that the viewer opened a post, for the Unread filter. */
export async function markPostRead(userId: string, postId: number) {
  await db().insert(Reads).values({ userId, postId, readAt: new Date() }).onConflictDoNothing();
}

async function categoryFor(scope: Scope, raw: unknown): Promise<number | null> {
  if (raw === null || raw === undefined || raw === "" || raw === 0) return null;
  const id = Number(raw);
  const c = Number.isInteger(id) ? await getCategory(id) : null;
  if (!c || c.communityId !== scope.community.id) throw invalid("That category does not exist.");
  if (c.status !== "published" && !scope.viewer.actor.superAdmin) throw invalid("That category is not available.");
  return c.id;
}

export type PostInput = { body: unknown; mediaIds?: number[]; alts?: Record<string, unknown>; categoryId?: unknown; requestId?: string | null };

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
  const categoryId = await categoryFor(scope, input.categoryId);
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
        INSERT INTO community_posts (community_id, author_id, body, category_id, request_id, created_at, updated_at, last_activity_at)
        VALUES (${community.id}, ${viewer.user.id}, ${mentions.body}, ${categoryId}, ${requestId}, ${now}, ${now}, ${now}) RETURNING id
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

/** Text edit. The author may edit; the SuperAdmin may edit anyone's text post. Rich posts are edited in the builder. */
export async function editPost(scope: Scope, post: PostRow, bodyRaw: unknown) {
  const { viewer, community, settings } = scope;
  if (post.kind === "rich") throw forbidden("Edit this post in the builder.");
  const a = viewer.actor;
  if (!(a.superAdmin && post.authorId !== a.id)) unwrap(canEditOwn(a, memberState(scope.membership), communityState(community), settings, post.authorId));
  if (post.status === "deleted" || post.status === "draft") throw notFound();
  if (a.superAdmin === false && post.status !== "published") throw notFound();
  const body = cleanBody(bodyRaw);
  if (body.length > LIMITS.postBody) throw invalid(`That is too long. The limit is ${LIMITS.postBody} characters.`);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(M).where(eq(M.postId, post.id));
  if (!body && !n) throw invalid("Write something or add an image.");
  const mentions = await resolveMentions({ body, authorId: post.authorId, communityId: community.id });
  const now = new Date();
  await db().update(P).set({ body: mentions.body, editedAt: now, updatedAt: now }).where(eq(P.id, post.id));
  await writeMentions({ sourceType: "post", sourceId: post.id, communityId: community.id, authorId: post.authorId, ids: mentions.ids, notify: { postId: post.id } });
  return (await getPost(scope, post.id))!;
}

export type PostMeta = { pinned?: boolean; commentsLocked?: boolean; categoryId?: number | null };

/** Pin, turn comments off or on, change category. */
export async function updatePostMeta(scope: Scope, post: PostRow, meta: PostMeta) {
  const { viewer, community, settings } = scope;
  const a = viewer.actor;
  if (post.status === "deleted") throw notFound();
  const set: Partial<typeof P.$inferInsert> = {};
  if (meta.pinned !== undefined) {
    unwrap(canPin(a));
    if (meta.pinned && post.status !== "published") throw invalid("Only published posts can be pinned.");
    set.pinnedAt = meta.pinned ? new Date() : null;
  }
  if (meta.commentsLocked !== undefined) {
    unwrap(canLockComments(a));
    set.commentsLocked = meta.commentsLocked;
  }
  if (meta.categoryId !== undefined) {
    unwrap(canChangeCategory(a, memberState(scope.membership), communityState(community), settings, post.authorId));
    set.categoryId = await categoryFor(scope, meta.categoryId);
  }
  if (!Object.keys(set).length) return;
  await db().update(P).set({ ...set, updatedAt: new Date() }).where(eq(P.id, post.id));
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
  await db().update(P).set({ status, updatedAt: now, deletedAt: status === "deleted" ? now : null, ...(status !== "published" ? { pinnedAt: null } : {}) }).where(eq(P.id, post.id));
  if (status !== "published") {
    await dropNotificationsFor({ postIds: [post.id] });
    await dropMentionsFor("post", [post.id]);
  }
}
