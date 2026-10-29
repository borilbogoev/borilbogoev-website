// Who is asking and what they are asking about: the actor, the community and the membership, loaded once per request.
import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@/db";
import { can } from "@/modules/auth/roles";
import type { CurrentUser } from "@/modules/auth/current";
import { db, notFound } from "./core";
import { canView, type Actor, type CommunityState, type MemberState } from "./permissions";
import { getSettings, type CommunitySettings } from "./settings";

const { communities, communityMembers, communitySuspensions } = schema;

export type CommunityRow = typeof communities.$inferSelect;
export type MemberRow = typeof communityMembers.$inferSelect;

export type Viewer = { user: CurrentUser; actor: Actor };

export async function isSuspended(userId: string): Promise<boolean> {
  const [r] = await db().select({ id: communitySuspensions.id }).from(communitySuspensions).where(and(eq(communitySuspensions.userId, userId), isNull(communitySuspensions.liftedAt))).limit(1);
  return !!r;
}

export async function viewerFor(user: CurrentUser): Promise<Viewer> {
  const superAdmin = can(user.role, "community.manage");
  return { user, actor: { id: user.id, superAdmin, suspended: await isSuspended(user.id) } };
}

export const communityState = (c: CommunityRow): CommunityState => ({ status: c.status as CommunityState["status"], visibility: c.visibility as CommunityState["visibility"], joinMode: c.joinMode as CommunityState["joinMode"] });
export const memberState = (m: MemberRow | null | undefined): MemberState => (m ? { role: m.role as "member" | "moderator", status: m.status as "active" | "banned" } : null);

export async function getCommunityBySlug(slug: string): Promise<CommunityRow | null> {
  const [c] = await db().select().from(communities).where(eq(communities.slug, slug.toLowerCase())).limit(1);
  return c ?? null;
}
export async function getCommunityById(id: number): Promise<CommunityRow | null> {
  const [c] = await db().select().from(communities).where(eq(communities.id, id)).limit(1);
  return c ?? null;
}
export async function getDefaultCommunity(): Promise<CommunityRow | null> {
  const [c] = await db().select().from(communities).where(eq(communities.isDefault, true)).limit(1);
  return c ?? null;
}

export async function getMembership(communityId: number, userId: string): Promise<MemberRow | null> {
  const [m] = await db().select().from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).limit(1);
  return m ?? null;
}

/** A community the viewer may see, with their membership. Hidden ones answer "not found". */
export type Scope = { viewer: Viewer; community: CommunityRow; membership: MemberRow | null; settings: CommunitySettings };

export async function scopeFor(viewer: Viewer, community: CommunityRow | null): Promise<Scope> {
  if (!community) throw notFound();
  const membership = await getMembership(community.id, viewer.user.id);
  if (!canView(viewer.actor, memberState(membership), communityState(community)).ok) throw notFound();
  return { viewer, community, membership, settings: await getSettings() };
}
export const scopeBySlug = async (viewer: Viewer, slug: string) => scopeFor(viewer, await getCommunityBySlug(slug));
export const scopeById = async (viewer: Viewer, id: number) => scopeFor(viewer, await getCommunityById(id));

const ensured = new Set<string>();

/** Lazy membership: the first visit to Community puts the person in the default community. Never un-bans anyone. */
export async function ensureDefaultMembership(userId: string): Promise<void> {
  if (ensured.has(userId)) return;
  const def = await getDefaultCommunity();
  if (!def) return;
  if (!(await getMembership(def.id, userId))) {
    await db().insert(communityMembers).values({ communityId: def.id, userId, role: "member", status: "active", joinedAt: new Date() }).onConflictDoNothing();
  }
  ensured.add(userId);
}
