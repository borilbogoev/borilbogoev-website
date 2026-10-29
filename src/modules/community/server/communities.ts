// Listing, joining and leaving communities, plus the @ suggestions.
import { and, asc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS } from "../lib/constants";
import { db, forbidden, run } from "./core";
import { communityState, memberState, type CommunityRow, type Scope, type Viewer } from "./context";
import { canJoin, canLeave } from "./permissions";
import { unwrap } from "./posts";
import { displayName } from "./people";

const { communities, communityMembers: Mem, communityBlocks: B, users } = schema;

export type CommunityDTO = {
  id: number;
  slug: string;
  name: string;
  description: string;
  iconUrl: string;
  coverUrl: string;
  visibility: string;
  joinMode: string;
  status: string;
  isDefault: boolean;
  members: number;
  joined: boolean;
  banned: boolean;
  canJoin: boolean;
};

// Member counts are not stored; a grouped count, cached for 30 seconds per server instance.
let countCache: { at: number; map: Map<number, number> } | null = null;
export async function memberCounts(): Promise<Map<number, number>> {
  if (countCache && Date.now() - countCache.at < 30_000) return countCache.map;
  const rows = await db().select({ id: Mem.communityId, n: sql<number>`count(*)::int` }).from(Mem).where(eq(Mem.status, "active")).groupBy(Mem.communityId);
  countCache = { at: Date.now(), map: new Map(rows.map((r) => [r.id, r.n])) };
  return countCache.map;
}
export const clearMemberCounts = () => {
  countCache = null;
};

export const toCommunityDTO = (c: CommunityRow, members: number, m: { role: string; status: string } | null, viewer: Viewer): CommunityDTO => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  description: c.description ?? "",
  iconUrl: c.iconUrl ?? "",
  coverUrl: c.coverUrl ?? "",
  visibility: c.visibility,
  joinMode: c.joinMode,
  status: c.status,
  isDefault: c.isDefault,
  members,
  joined: !!m,
  banned: m?.status === "banned",
  canJoin: canJoin(viewer.actor, memberState(m as never), communityState(c)).ok,
});

/** Communities the viewer may see: listed ones, plus hidden ones they belong to (the SuperAdmin sees all). */
export async function listCommunities(viewer: Viewer): Promise<CommunityDTO[]> {
  const [rows, counts, mine] = await Promise.all([
    db().select().from(communities).orderBy(asc(communities.sortOrder), asc(communities.name)),
    memberCounts(),
    db().select().from(Mem).where(eq(Mem.userId, viewer.user.id)),
  ]);
  const mem = new Map(mine.map((m) => [m.communityId, m]));
  return rows
    .filter((c) => viewer.actor.superAdmin || c.visibility === "listed" || mem.has(c.id))
    .map((c) => toCommunityDTO(c, counts.get(c.id) ?? 0, mem.get(c.id) ?? null, viewer));
}

export async function joinCommunity(scope: Scope) {
  unwrap(canJoin(scope.viewer.actor, memberState(scope.membership), communityState(scope.community)));
  await db().insert(Mem).values({ communityId: scope.community.id, userId: scope.viewer.user.id, role: "member", status: "active", joinedAt: new Date() }).onConflictDoNothing();
  clearMemberCounts();
}

export async function leaveCommunity(scope: Scope) {
  unwrap(canLeave(memberState(scope.membership), scope.community));
  if (scope.membership?.status === "banned") throw forbidden("You can't leave while banned.");
  await db().delete(Mem).where(and(eq(Mem.communityId, scope.community.id), eq(Mem.userId, scope.viewer.user.id)));
  clearMemberCounts();
}

export type SuggestDTO = { id: string; name: string; username: string; avatarUrl: string };

const like = (q: string) => `${q.replace(/[\\%_]/g, "\\$&")}%`;

/** People for the @ list. In a community: its active members. In chat: people you talk to first, then anyone by username prefix. */
export async function suggest(viewer: Viewer, opts: { q: string; scope?: Scope }): Promise<SuggestDTO[]> {
  const q = opts.q.trim().replace(/^@/, "");
  const me = viewer.user.id;
  const out = (rows: { id: string; name: string; username: string | null; avatarUrl: string | null }[]): SuggestDTO[] => rows.map((r) => ({ id: r.id, name: displayName(r), username: r.username ?? "", avatarUrl: r.avatarUrl ?? "" }));

  if (opts.scope) {
    const match = q ? or(ilike(users.name, like(q)), ilike(users.name, `% ${like(q)}`), ilike(users.username, like(q))) : undefined;
    const rows = await db()
      .select({ id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl })
      .from(Mem)
      .innerJoin(users, eq(users.id, Mem.userId))
      .where(and(eq(Mem.communityId, opts.scope.community.id), eq(Mem.status, "active"), eq(users.status, "active"), ne(users.id, me), match))
      .orderBy(asc(users.name))
      .limit(LIMITS.suggest);
    return out(rows);
  }
  if (q.length < 2) return [];
  const talking = await run<{ id: string; name: string; username: string | null; avatar_url: string | null }>(sql`
    SELECT u.id, u.name, u.username, u.avatar_url FROM community_conversation_participants mine
    JOIN community_conversation_participants other ON other.conversation_id = mine.conversation_id AND other.user_id <> ${me}
    JOIN users u ON u.id = other.user_id
    WHERE mine.user_id = ${me} AND u.status = 'active' AND (u.name ILIKE ${like(q)} OR u.name ILIKE ${"% " + like(q)} OR u.username ILIKE ${like(q)})
    LIMIT ${LIMITS.suggest}`);
  const first = out(talking.map((r) => ({ id: r.id, name: r.name, username: r.username, avatarUrl: r.avatar_url })));
  if (first.length >= LIMITS.suggest) return first;
  const have = new Set(first.map((f) => f.id));
  const blockedMe = db().select({ id: B.blockerId }).from(B).where(eq(B.blockedId, me));
  const rest = await db()
    .select({ id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl })
    .from(users)
    .where(and(eq(users.status, "active"), ne(users.id, me), ilike(users.username, like(q)), sql`${users.id} not in (${blockedMe})`))
    .orderBy(asc(users.username))
    .limit(LIMITS.suggest);
  return [...first, ...out(rest.filter((r) => !have.has(r.id)))].slice(0, LIMITS.suggest);
}
