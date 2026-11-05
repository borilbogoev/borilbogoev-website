// The public face of a public community: its published rich posts, readable by anyone. No viewer, no session, no cookies, so
// pages that use it stay static. Only `kind = 'rich'`, `status = 'published'` posts of communities with `access = 'public'` ever leave here.
import { and, asc, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { publicPostHref, type PublicPick, type PublicRange, type PublicSort } from "../lib/public";
import { highlightsOf, isTheme, snippetCover, type Featured, type Highlight, type RichBlock, type Theme } from "../lib/rich";
import type { CurrentUser } from "@/modules/auth/current";
import { listComments } from "./comments";
import { getCommunityById, type Scope } from "./context";
import { db } from "./core";
import { getSettings } from "./settings";

const { communityPosts: P, communities: Co, communityCategories: K } = schema;

export { PUBLIC_PICKS, PUBLIC_RANGES, PUBLIC_SORTS, publicPostHref, type PublicPick, type PublicRange, type PublicSort } from "../lib/public";

export type PublicCommunity = { id: number; slug: string; name: string; description: string };
export type PublicCategory = { id: number; communityId: number; slug: string; name: string };

export type PublicPost = {
  id: number;
  communityId: number;
  communitySlug: string;
  communityName: string;
  title: string;
  excerpt: string;
  theme: Theme;
  cover: string;
  coverVideo: boolean;
  highlights: Highlight[];
  pinned: boolean;
  categoryId: number | null;
  categoryName: string;
  categorySlug: string;
  commentCount: number;
  likeCount: number;
  commentsLocked: boolean;
  createdAt: string;
  href: string;
};

const visibleBase = and(eq(P.kind, "rich"), eq(P.status, "published"), eq(Co.access, "public"));

type Row = { p: typeof P.$inferSelect; cslug: string; cname: string; kname: string | null; kslug: string | null };

function toPublic({ p, cslug, cname, kname, kslug }: Row): PublicPost {
  const blocks = (Array.isArray(p.blocks) ? p.blocks : []) as RichBlock[];
  const cover = snippetCover(blocks, p.featured as Featured);
  return {
    id: p.id,
    communityId: p.communityId,
    communitySlug: cslug,
    communityName: cname,
    title: p.title ?? "",
    excerpt: p.body,
    theme: isTheme(p.theme) ? p.theme : "ink",
    cover: cover.url,
    coverVideo: cover.video,
    highlights: highlightsOf(blocks, 4),
    pinned: !!p.pinnedAt,
    categoryId: p.categoryId,
    categoryName: kname ?? "",
    categorySlug: kslug ?? "",
    commentCount: p.commentCount,
    likeCount: p.likeCount,
    commentsLocked: p.commentsLocked,
    createdAt: p.createdAt.toISOString(),
    href: publicPostHref(cslug, p.id),
  };
}

const select = () =>
  db()
    .select({ p: P, cslug: Co.slug, cname: Co.name, kname: K.name, kslug: K.slug })
    .from(P)
    .innerJoin(Co, eq(Co.id, P.communityId))
    .leftJoin(K, eq(K.id, P.categoryId));

/** Communities that are public, for the builder and the pages. */
export async function listPublicCommunities(): Promise<PublicCommunity[]> {
  const rows = await db().select({ id: Co.id, slug: Co.slug, name: Co.name, description: Co.description }).from(Co).where(eq(Co.access, "public")).orderBy(asc(Co.sortOrder), asc(Co.name));
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, description: r.description ?? "" }));
}

/** Published categories of the public communities (the tabs of their feeds). */
export async function listPublicCategories(): Promise<PublicCategory[]> {
  const rows = await db()
    .select({ id: K.id, communityId: K.communityId, slug: K.slug, name: K.name })
    .from(K)
    .innerJoin(Co, eq(Co.id, K.communityId))
    .where(and(eq(Co.access, "public"), eq(K.status, "published")))
    .orderBy(asc(K.communityId), asc(K.position), asc(K.name));
  return rows;
}

export type PublicQuery = {
  communityId: number;
  categoryId?: number | null;
  range?: PublicRange;
  sort?: PublicSort;
  pinnedFirst?: boolean;
  limit?: number;
  excludeId?: number | null;
};

/** A filtered list of public posts. `limit` is clamped to 1..24. */
export async function queryPublicPosts(q: PublicQuery): Promise<PublicPost[]> {
  const limit = Math.min(24, Math.max(1, Math.trunc(q.limit ?? 6)));
  const days = q.range && q.range !== "all" ? Number(q.range) : 0;
  const where: (SQL | undefined)[] = [visibleBase, eq(P.communityId, q.communityId)];
  if (q.categoryId) where.push(eq(P.categoryId, q.categoryId));
  if (days > 0) where.push(gte(P.createdAt, new Date(Date.now() - days * 86_400_000)));
  if (q.excludeId) where.push(sql`${P.id} <> ${q.excludeId}`);
  const order: SQL[] = [];
  if (q.pinnedFirst) order.push(sql`${P.pinnedAt} desc nulls last`);
  if (q.sort === "top") order.push(desc(P.likeCount), desc(P.createdAt));
  else if (q.sort === "discussed") order.push(desc(P.commentCount), desc(P.createdAt));
  else order.push(desc(P.createdAt));
  order.push(desc(P.id));
  const rows = await select()
    .where(and(...where))
    .orderBy(...order)
    .limit(limit);
  return rows.map(toPublic);
}

/** One post for the Featured block: the pinned or newest or most liked of a community, or a chosen one. */
export async function pickPublicPost(o: { communityId: number; categoryId?: number | null; pick: PublicPick; postId?: number | null; range?: PublicRange }): Promise<PublicPost | null> {
  if (o.pick === "post") {
    if (!o.postId) return null;
    const [row] = await select()
      .where(and(visibleBase, eq(P.id, o.postId), eq(P.communityId, o.communityId)))
      .limit(1);
    return row ? toPublic(row) : null;
  }
  const [post] = await queryPublicPosts({ communityId: o.communityId, categoryId: o.categoryId, range: o.range, sort: o.pick === "top" ? "top" : "new", pinnedFirst: o.pick === "pinned", limit: 1 });
  return post ?? null;
}

/** Posts the builder can offer for "a post I choose": newest 200 of the public communities. */
export async function listPublicPostOptions(): Promise<{ id: number; communityId: number; title: string }[]> {
  const rows = await db()
    .select({ id: P.id, communityId: P.communityId, title: P.title })
    .from(P)
    .innerJoin(Co, eq(Co.id, P.communityId))
    .where(visibleBase)
    .orderBy(desc(P.createdAt))
    .limit(200);
  return rows.map((r) => ({ id: r.id, communityId: r.communityId, title: r.title ?? "Untitled post" }));
}

export type PublicPostFull = PublicPost & { blocks: RichBlock[]; communityDescription: string; updatedAt: string };

/** A public post with its blocks, or null when it is not public (draft, hidden, deleted, private community, plain post). */
export async function getPublicPost(id: number): Promise<PublicPostFull | null> {
  const [row] = await select().where(and(visibleBase, eq(P.id, id))).limit(1);
  if (!row) return null;
  const [co] = await db().select({ d: Co.description }).from(Co).where(eq(Co.id, row.p.communityId)).limit(1);
  return { ...toPublic(row), blocks: (Array.isArray(row.p.blocks) ? row.p.blocks : []) as RichBlock[], communityDescription: co?.d ?? "", updatedAt: row.p.updatedAt.toISOString() };
}

/** Every public post, for the sitemap. */
export async function listPublicPostLinks(): Promise<{ href: string; updatedAt: string }[]> {
  const rows = await select().where(visibleBase).orderBy(desc(P.createdAt)).limit(1000);
  return rows.map((r) => ({ href: publicPostHref(r.cslug, r.p.id), updatedAt: r.p.updatedAt.toISOString() }));
}

// A scope for someone who is not signed in: nobody owns, edits or likes anything, so comments come back with every flag off.
const NOBODY = "00000000-0000-0000-0000-000000000000";

/** Published comments of a public post, oldest first. `after` is the polling cursor, `cursor` the page cursor; both use the same value. */
export async function listPublicComments(postId: number, cursor: string | null) {
  const post = await getPublicPost(postId);
  if (!post) return null;
  const community = await getCommunityById(post.communityId);
  if (!community) return null;
  const scope: Scope = {
    viewer: { user: { id: NOBODY } as CurrentUser, actor: { id: NOBODY, superAdmin: false, suspended: false } },
    community,
    membership: null,
    settings: await getSettings(),
  };
  const page = await listComments(scope, postId, cursor);
  return { ...page, commentCount: post.commentCount };
}
