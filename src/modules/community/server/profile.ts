// The Community tab of a profile: a person's posts, comments and mentions, filtered by what the VIEWER may see.
// Hidden, deleted and moderated content never appears, and neither does anything from a hidden community the viewer is not in.
import { and, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS } from "../lib/constants";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { snippet } from "../lib/text";
import { db } from "./core";
import type { Viewer } from "./context";
import { loadPeople, type People } from "./people";
import { mediaFor } from "./posts";

const { communityPosts: P, communityComments: C, communityMentions: Mn, communities: Co, communityMembers: Mem } = schema;

/** SQL condition: the community is listed, or the viewer is a member of it, or the viewer is the SuperAdmin. */
function seesCommunity(viewer: Viewer): SQL | undefined {
  if (viewer.actor.superAdmin) return undefined;
  return or(eq(Co.visibility, "listed"), sql`exists (select 1 from ${Mem} where ${Mem.communityId} = ${Co.id} and ${Mem.userId} = ${viewer.user.id})`);
}

export type ProfileItem = {
  kind: "post" | "comment" | "mention";
  id: number;
  communitySlug: string;
  communityName: string;
  postId: number;
  createdAt: string;
  snippet: string;
  commentCount?: number;
  imageCount?: number;
  by?: string; // mention: who mentioned
  href: string;
  cursor: string;
};
export type ProfilePage = { items: ProfileItem[]; nextCursor: string | null; people: People };

export type ProfileQuery = { viewer: Viewer; targetId: string; communityId?: number | null; cursor?: string | null };

const cursorWhere = (at: SQL | unknown, id: SQL | unknown, cur: ReturnType<typeof decodeCursor>) =>
  cur ? or(lt(at as never, cur.at), and(eq(at as never, cur.at), lt(id as never, cur.id))) : undefined;

export async function profilePosts(q: ProfileQuery): Promise<ProfilePage> {
  const cur = decodeCursor(q.cursor);
  const rows = await db()
    .select({ post: P, slug: Co.slug, cname: Co.name })
    .from(P)
    .innerJoin(Co, eq(Co.id, P.communityId))
    .where(and(eq(P.authorId, q.targetId), eq(P.status, "published"), seesCommunity(q.viewer), q.communityId ? eq(P.communityId, q.communityId) : undefined, cursorWhere(P.createdAt, P.id, cur)))
    .orderBy(desc(P.createdAt), desc(P.id))
    .limit(LIMITS.postPage + 1);
  const page = rows.slice(0, LIMITS.postPage);
  const media = await mediaFor(page.map((r) => r.post.id));
  const items = page.map((r): ProfileItem => ({
    kind: "post",
    id: r.post.id,
    communitySlug: r.slug,
    communityName: r.cname,
    postId: r.post.id,
    createdAt: r.post.createdAt.toISOString(),
    snippet: snippet(r.post.body, 200),
    commentCount: r.post.commentCount,
    imageCount: media.get(r.post.id)?.length ?? 0,
    href: `/community/${r.slug}/post/${r.post.id}`,
    cursor: encodeCursor(r.post),
  }));
  return { items, nextCursor: rows.length > LIMITS.postPage ? items[items.length - 1].cursor : null, people: {} };
}

export async function profileComments(q: ProfileQuery): Promise<ProfilePage> {
  const cur = decodeCursor(q.cursor);
  const rows = await db()
    .select({ c: C, slug: Co.slug, cname: Co.name })
    .from(C)
    .innerJoin(P, eq(P.id, C.postId))
    .innerJoin(Co, eq(Co.id, C.communityId))
    .where(and(eq(C.authorId, q.targetId), eq(C.status, "published"), eq(P.status, "published"), seesCommunity(q.viewer), q.communityId ? eq(C.communityId, q.communityId) : undefined, cursorWhere(C.createdAt, C.id, cur)))
    .orderBy(desc(C.createdAt), desc(C.id))
    .limit(LIMITS.postPage + 1);
  const page = rows.slice(0, LIMITS.postPage);
  const items = page.map((r): ProfileItem => ({
    kind: "comment",
    id: r.c.id,
    communitySlug: r.slug,
    communityName: r.cname,
    postId: r.c.postId,
    createdAt: r.c.createdAt.toISOString(),
    snippet: snippet(r.c.body, 200),
    href: `/community/${r.slug}/post/${r.c.postId}#comment-${r.c.id}`,
    cursor: encodeCursor(r.c),
  }));
  return { items, nextCursor: rows.length > LIMITS.postPage ? items[items.length - 1].cursor : null, people: {} };
}

/** Posts and comments that mention the person. Chat mentions are private and never listed here. */
export async function profileMentions(q: ProfileQuery): Promise<ProfilePage> {
  const cur = decodeCursor(q.cursor);
  const rows = await db()
    .select({ m: Mn, slug: Co.slug, cname: Co.name, postBody: P.body, postId: P.id, commentBody: C.body })
    .from(Mn)
    .innerJoin(Co, eq(Co.id, Mn.communityId))
    .leftJoin(C, and(eq(Mn.sourceType, "comment"), eq(C.id, Mn.sourceId)))
    .leftJoin(P, or(and(eq(Mn.sourceType, "post"), eq(P.id, Mn.sourceId)), eq(P.id, C.postId)))
    .where(
      and(
        eq(Mn.mentionedUserId, q.targetId),
        inArray(Mn.sourceType, ["post", "comment"]),
        eq(P.status, "published"),
        or(sql`${C.id} is null`, eq(C.status, "published")),
        seesCommunity(q.viewer),
        q.communityId ? eq(Mn.communityId, q.communityId) : undefined,
        cursorWhere(Mn.createdAt, Mn.id, cur),
      ),
    )
    .orderBy(desc(Mn.createdAt), desc(Mn.id))
    .limit(LIMITS.postPage + 1);
  const page = rows.slice(0, LIMITS.postPage);
  const people = await loadPeople(page.map((r) => r.m.authorId));
  const items = page.map((r): ProfileItem => ({
    kind: "mention",
    id: r.m.sourceId,
    communitySlug: r.slug,
    communityName: r.cname,
    postId: r.postId as number,
    createdAt: r.m.createdAt.toISOString(),
    snippet: snippet(r.commentBody ?? r.postBody ?? "", 200),
    by: r.m.authorId,
    href: `/community/${r.slug}/post/${r.postId}${r.m.sourceType === "comment" ? `#comment-${r.m.sourceId}` : ""}`,
    cursor: encodeCursor(r.m),
  }));
  return { items, nextCursor: rows.length > LIMITS.postPage ? items[items.length - 1].cursor : null, people };
}

/** Communities for the filter dropdown: the ones the viewer can see. */
export async function filterCommunities(viewer: Viewer): Promise<{ id: number; name: string }[]> {
  return db().select({ id: Co.id, name: Co.name }).from(Co).where(seesCommunity(viewer)).orderBy(Co.sortOrder, Co.name);
}
