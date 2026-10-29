// Rich posts: built from the Landing Pages blocks, SuperAdmin only. They are ordinary posts (kind = 'rich') with a title,
// a short excerpt in `body` and the blocks in `blocks`, so likes, comments, pinning and moderation work unchanged.
import { and, desc, eq, ne } from "drizzle-orm";
import { schema } from "@/db";
import { isLandingBlockType, sanitizeLandingBlock } from "@/modules/landing/lib/blocks";
import { MAX_RICH_BLOCKS } from "../lib/constants";
import { coverOf, highlightsOf, type Highlight, type RichBlock } from "../lib/rich";
import { cleanBody } from "../lib/text";
import { db, invalid, notFound, unwrap } from "./core";
import { log } from "./audit";
import { getCategory } from "./categories";
import { getCommunityById, type Viewer } from "./context";
import { canBuildRich } from "./permissions";

const { communityPosts: P, communities: Co, communityCategories: K } = schema;

/** Keeps only known block types and cleans each block's settings against its schema. */
export function sanitizeBlocks(input: unknown): RichBlock[] {
  if (!Array.isArray(input)) return [];
  const out: RichBlock[] = [];
  for (const raw of input.slice(0, MAX_RICH_BLOCKS)) {
    const t = (raw as { type?: unknown })?.type;
    if (!isLandingBlockType(t)) continue;
    out.push({ type: t, settings: sanitizeLandingBlock(t, (raw as { settings?: unknown }).settings) });
  }
  return out;
}

export type RichInput = { communityId?: unknown; categoryId?: unknown; title?: unknown; excerpt?: unknown; blocks?: unknown; status?: unknown };

const title140 = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 140) : "");

async function categoryIdFor(communityId: number, raw: unknown): Promise<number | null> {
  if (raw === null || raw === undefined || raw === "" || raw === 0 || raw === "0") return null;
  const c = await getCategory(Number(raw));
  if (!c || c.communityId !== communityId) throw invalid("That category does not exist.");
  return c.id;
}

/** A new empty draft, then the builder opens on it. */
export async function createRich(viewer: Viewer, input: RichInput): Promise<number> {
  unwrap(canBuildRich(viewer.actor));
  const communityId = Number(input.communityId);
  if (!Number.isInteger(communityId) || !(await getCommunityById(communityId))) throw invalid("Choose a community.");
  const now = new Date();
  const [row] = await db()
    .insert(P)
    .values({
      communityId,
      authorId: viewer.user.id,
      kind: "rich",
      title: title140(input.title) || "Untitled post",
      body: "",
      blocks: [],
      categoryId: await categoryIdFor(communityId, input.categoryId),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })
    .returning({ id: P.id });
  await log(viewer.user.id, "rich.create", "post", row.id, { communityId });
  return row.id;
}

export type RichDTO = {
  id: number;
  communityId: number;
  categoryId: number | null;
  title: string;
  excerpt: string;
  blocks: RichBlock[];
  status: string;
  pinned: boolean;
  commentsLocked: boolean;
};

export async function getRich(viewer: Viewer, id: number): Promise<RichDTO> {
  unwrap(canBuildRich(viewer.actor));
  const [p] = await db().select().from(P).where(and(eq(P.id, id), eq(P.kind, "rich"), ne(P.status, "deleted"))).limit(1);
  if (!p) throw notFound();
  return { id: p.id, communityId: p.communityId, categoryId: p.categoryId, title: p.title ?? "", excerpt: p.body, blocks: (Array.isArray(p.blocks) ? p.blocks : []) as RichBlock[], status: p.status, pinned: !!p.pinnedAt, commentsLocked: p.commentsLocked };
}

/** Save from the builder. Publishing needs a title and at least one block; the first publish sets the date the feed sorts by. */
export async function saveRich(viewer: Viewer, id: number, input: RichInput): Promise<RichDTO> {
  const cur = await getRich(viewer, id);
  const title = input.title !== undefined ? title140(input.title) : cur.title;
  const excerpt = input.excerpt !== undefined ? cleanBody(input.excerpt).slice(0, 400) : cur.excerpt;
  const blocks = input.blocks !== undefined ? sanitizeBlocks(input.blocks) : cur.blocks;
  const communityId = input.communityId !== undefined ? Number(input.communityId) : cur.communityId;
  if (!Number.isInteger(communityId) || !(await getCommunityById(communityId))) throw invalid("Choose a community.");
  const categoryId = input.categoryId !== undefined ? await categoryIdFor(communityId, input.categoryId) : communityId === cur.communityId ? cur.categoryId : null;
  const wantStatus = input.status === "published" ? "published" : input.status === "draft" ? "draft" : cur.status === "hidden_by_mod" ? "hidden_by_mod" : cur.status;
  if (wantStatus === "published") {
    if (!title) throw invalid("Give the post a title before publishing.");
    if (!blocks.length) throw invalid("Add at least one block before publishing.");
  }
  const now = new Date();
  const set: Partial<typeof P.$inferInsert> = { title: title || "Untitled post", body: excerpt, blocks, communityId, categoryId, updatedAt: now };
  if (wantStatus !== cur.status && (wantStatus === "published" || wantStatus === "draft")) {
    set.status = wantStatus;
    if (cur.status === "draft" && wantStatus === "published") {
      set.createdAt = now;
      set.lastActivityAt = now;
    }
    if (wantStatus === "draft") set.pinnedAt = null;
  }
  await db().update(P).set(set).where(eq(P.id, id));
  await log(viewer.user.id, wantStatus !== cur.status ? `rich.${wantStatus}` : "rich.save", "post", id);
  return getRich(viewer, id);
}

export type RichListRow = {
  id: number;
  title: string;
  excerpt: string;
  status: string;
  pinned: boolean;
  commentsLocked: boolean;
  communityId: number;
  communityName: string;
  communitySlug: string;
  categoryName: string;
  likes: number;
  comments: number;
  cover: string;
  highlights: Highlight[];
  blocks: number;
  updatedAt: string;
};

export async function listRich(viewer: Viewer, f: { communityId?: number | null; status?: string }): Promise<RichListRow[]> {
  unwrap(canBuildRich(viewer.actor));
  const rows = await db()
    .select({ p: P, cname: Co.name, cslug: Co.slug, kname: K.name })
    .from(P)
    .innerJoin(Co, eq(Co.id, P.communityId))
    .leftJoin(K, eq(K.id, P.categoryId))
    .where(and(eq(P.kind, "rich"), ne(P.status, "deleted"), f.communityId ? eq(P.communityId, f.communityId) : undefined, f.status ? eq(P.status, f.status) : undefined))
    .orderBy(desc(P.updatedAt))
    .limit(200);
  return rows.map(({ p, cname, cslug, kname }) => {
    const blocks = (Array.isArray(p.blocks) ? p.blocks : []) as RichBlock[];
    return {
      id: p.id,
      title: p.title ?? "",
      excerpt: p.body,
      status: p.status,
      pinned: !!p.pinnedAt,
      commentsLocked: p.commentsLocked,
      communityId: p.communityId,
      communityName: cname,
      communitySlug: cslug,
      categoryName: kname ?? "",
      likes: p.likeCount,
      comments: p.commentCount,
      cover: coverOf(blocks),
      highlights: highlightsOf(blocks, 4),
      blocks: blocks.length,
      updatedAt: p.updatedAt.toISOString(),
    };
  });
}

