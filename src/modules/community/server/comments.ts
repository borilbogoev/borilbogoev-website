import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS } from "../lib/constants";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { cleanBody } from "../lib/text";
import { db, invalid, isUniqueViolation, notFound, run } from "./core";
import { communityState, memberState, type Scope } from "./context";
import { dropMentionsFor, resolveMentions, writeMentions } from "./mentions";
import { dropNotificationsFor } from "./notifications";
import { canComment, canEditOwn, canModerateContent } from "./permissions";
import { loadPeopleFor, type People, type Person } from "./people";
import { getPostRow, unwrap } from "./posts";
import { checkRate } from "./rate";

const { communityComments: C, communityPosts: P, communityNotifications: N, users } = schema;

export type CommentDTO = {
  id: number;
  postId: number;
  author: Person;
  body: string;
  createdAt: string;
  editedAt: string | null;
  status: "published" | "hidden_by_mod";
  cursor: string;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};
export type CommentRow = typeof C.$inferSelect;

function flags(scope: Scope, authorId: string, status: string) {
  const a = scope.viewer.actor;
  const m = memberState(scope.membership);
  const c = communityState(scope.community);
  const mine = authorId === a.id;
  const own = mine && canEditOwn(a, m, c, scope.settings, authorId).ok;
  const mod = !mine && canModerateContent(a, m, c).ok;
  return { mine, canEdit: own && status === "published", canDelete: own || mod, canModerate: mod };
}

async function toDTOs(scope: Scope, rows: { comment: CommentRow }[]): Promise<{ items: CommentDTO[]; people: People }> {
  const people = await loadPeopleFor(rows.map((r) => r.comment.authorId), rows.map((r) => r.comment.body));
  return {
    people,
    items: rows.map(({ comment: c }) => ({
      id: c.id,
      postId: c.postId,
      author: people[c.authorId],
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt ? c.editedAt.toISOString() : null,
      status: c.status as CommentDTO["status"],
      cursor: encodeCursor(c),
      ...flags(scope, c.authorId, c.status),
    })),
  };
}

const visible = (scope: Scope) => or(eq(C.status, "published"), and(eq(C.status, "hidden_by_mod"), eq(C.authorId, scope.viewer.user.id)));

/** Oldest first. `after` is both the page cursor and the polling cursor. */
export async function listComments(scope: Scope, postId: number, afterRaw: string | null, limit: number = LIMITS.commentPage) {
  const after = decodeCursor(afterRaw);
  const rows = await db()
    .select({ comment: C })
    .from(C)
    .innerJoin(users, eq(users.id, C.authorId))
    .where(and(eq(C.postId, postId), visible(scope), after ? or(gt(C.createdAt, after.at), and(eq(C.createdAt, after.at), gt(C.id, after.id))) : undefined))
    .orderBy(asc(C.createdAt), asc(C.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const { items, people } = await toDTOs(scope, page);
  return { items, people, nextCursor: rows.length > limit ? items[items.length - 1].cursor : null };
}

export async function getCommentRow(id: number): Promise<CommentRow | null> {
  const [c] = await db().select().from(C).where(eq(C.id, id)).limit(1);
  return c ?? null;
}

export async function createComment(scope: Scope, postId: number, input: { body: unknown; requestId?: string | null }) {
  const { viewer, community, settings } = scope;
  const post = await getPostRow(postId);
  if (!post || post.communityId !== community.id || post.status !== "published") throw notFound();
  unwrap(canComment(viewer.actor, memberState(scope.membership), communityState(community), settings));
  const body = cleanBody(input.body);
  if (!body) throw invalid("Write something first.");
  if (body.length > LIMITS.commentBody) throw invalid(`That is too long. The limit is ${LIMITS.commentBody} characters.`);
  const requestId = typeof input.requestId === "string" && input.requestId.length <= 64 ? input.requestId : null;

  const existing = async () => {
    if (!requestId) return null;
    const [dup] = await db().select({ comment: C }).from(C).where(and(eq(C.authorId, viewer.user.id), eq(C.requestId, requestId))).limit(1);
    return dup ? { ...(await toDTOs(scope, [dup])), duplicate: true } : null;
  };
  const dup = await existing();
  if (dup) return { item: dup.items[0], people: dup.people, duplicate: true };
  await checkRate(viewer, "comment");

  const mentions = await resolveMentions({ body, authorId: viewer.user.id, communityId: community.id });
  const now = new Date();
  let id: number;
  try {
    // Comment and counter in one statement, so the count never drifts.
    const [row] = await run<{ id: number }>(sql`
      WITH c AS (
        INSERT INTO community_comments (post_id, community_id, author_id, body, request_id, created_at)
        VALUES (${post.id}, ${community.id}, ${viewer.user.id}, ${mentions.body}, ${requestId}, ${now}) RETURNING id
      ), u AS (
        UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ${post.id} RETURNING id
      )
      SELECT id FROM c`);
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await existing();
      if (again) return { item: again.items[0], people: again.people, duplicate: true };
    }
    throw e;
  }
  // Someone mentioned in the comment who also owns the post gets the mention only once.
  const notifyAuthor = post.authorId !== viewer.user.id;
  await writeMentions({ sourceType: "comment", sourceId: id, communityId: community.id, authorId: viewer.user.id, ids: mentions.ids, notify: { postId: post.id, commentId: id, skip: new Set(notifyAuthor ? [post.authorId] : []) } });
  if (notifyAuthor) {
    await db().insert(N).values({ userId: post.authorId, type: "post_comment", actorId: viewer.user.id, communityId: community.id, postId: post.id, commentId: id, sourceType: "comment", sourceId: id, createdAt: now });
  }
  const [row] = await db().select({ comment: C }).from(C).where(eq(C.id, id)).limit(1);
  const out = await toDTOs(scope, [row]);
  return { item: out.items[0], people: out.people, duplicate: false };
}

export async function editComment(scope: Scope, comment: CommentRow, bodyRaw: unknown) {
  const { viewer, community, settings } = scope;
  unwrap(canEditOwn(viewer.actor, memberState(scope.membership), communityState(community), settings, comment.authorId));
  if (comment.status !== "published") throw notFound();
  const body = cleanBody(bodyRaw);
  if (!body) throw invalid("Write something first.");
  if (body.length > LIMITS.commentBody) throw invalid(`That is too long. The limit is ${LIMITS.commentBody} characters.`);
  const mentions = await resolveMentions({ body, authorId: viewer.user.id, communityId: community.id });
  await db().update(C).set({ body: mentions.body, editedAt: new Date() }).where(eq(C.id, comment.id));
  const [post] = await db().select({ authorId: P.authorId }).from(P).where(eq(P.id, comment.postId)).limit(1);
  await writeMentions({
    sourceType: "comment",
    sourceId: comment.id,
    communityId: community.id,
    authorId: viewer.user.id,
    ids: mentions.ids,
    notify: { postId: comment.postId, commentId: comment.id, skip: new Set(post ? [post.authorId] : []) },
  });
  const [row] = await db().select({ comment: C }).from(C).where(eq(C.id, comment.id)).limit(1);
  const out = await toDTOs(scope, [row]);
  return { item: out.items[0], people: out.people };
}

/** Delete (author or moderator), hide and show again (moderator). The post counter moves in the same statement. */
export async function setCommentStatus(scope: Scope, comment: CommentRow, status: "deleted" | "hidden_by_mod" | "published") {
  const { viewer, community, settings } = scope;
  const a = viewer.actor;
  const m = memberState(scope.membership);
  const c = communityState(community);
  const mine = comment.authorId === a.id;
  if (status === "deleted" && mine) unwrap(canEditOwn(a, m, c, settings, comment.authorId));
  else unwrap(canModerateContent(a, m, c));
  const old = comment.status;
  if (old === "deleted" || old === status) throw notFound();
  const delta = (status === "published" ? 1 : 0) - (old === "published" ? 1 : 0);
  await run(sql`
    WITH c AS (
      UPDATE community_comments SET status = ${status}, deleted_at = ${status === "deleted" ? new Date() : null}
      WHERE id = ${comment.id} AND status = ${old} RETURNING post_id
    )
    UPDATE community_posts SET comment_count = greatest(comment_count + ${delta}, 0) WHERE id IN (SELECT post_id FROM c)`);
  if (status !== "published") {
    await dropNotificationsFor({ commentIds: [comment.id] });
    await dropMentionsFor("comment", [comment.id]);
  }
}
