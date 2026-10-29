// The control panel's data and actions. SuperAdmin does everything; a moderator only sees Members and Reports of their own communities.
// Each function checks the actor itself (never trust the page that called it) and writes to community_admin_log.
import { and, asc, count, desc, eq, gte, ilike, inArray, ne, or } from "drizzle-orm";
import { schema } from "@/db";
import { RESERVED_SLUGS, SORT_RULES, JOIN_MODES, VISIBILITY, COMMUNITY_STATUS, REPORT_ACTIONS, type ReportAction } from "../lib/constants";
import { snippet } from "../lib/text";
import { log } from "./audit";
import { CommunityError, db, forbidden, invalid, isUniqueViolation, isUuid, notFound, unwrap } from "./core";
import { getCommunityById, getMembership, memberState, communityState, scopeById, type CommunityRow, type Viewer } from "./context";
import { canAssignModerators, canBan, canManageCommunities, canManageGlobal, canSeeReports } from "./permissions";
import { clearMemberCounts, memberCounts } from "./communities";
import { clearSettingsCache, getSettings } from "./settings";
import { getCommentRow, setCommentStatus } from "./comments";
import { getPostRow, mediaFor, setPostStatus } from "./posts";
import { suspendUser } from "./safety";

const { communities, communityMembers: Mem, communityPosts: P, communityComments: C, communityReports: R, communitySettings: Set_, communityAdminLog: Log, communityMessages: Msg, users } = schema;

export { log };

/** Communities the viewer moderates: all of them for the SuperAdmin. */
export async function moderatedIds(viewer: Viewer): Promise<number[] | "all"> {
  if (viewer.actor.superAdmin) return "all";
  const rows = await db().select({ id: Mem.communityId }).from(Mem).where(and(eq(Mem.userId, viewer.user.id), eq(Mem.role, "moderator"), eq(Mem.status, "active")));
  return rows.map((r) => r.id);
}
export async function assertModerates(viewer: Viewer, communityId: number) {
  const ids = await moderatedIds(viewer);
  if (ids !== "all" && !ids.includes(communityId)) throw forbidden();
}
const requireSuper = (viewer: Viewer) => unwrap(canManageGlobal(viewer.actor));

// ---------------------------------------------------------------- overview

export async function overview(viewer: Viewer) {
  requireSuper(viewer);
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [[c], [m], [p], [cm], [r], entries] = await Promise.all([
    db().select({ n: count() }).from(communities),
    db().select({ n: count() }).from(Mem).where(eq(Mem.status, "active")),
    db().select({ n: count() }).from(P).where(and(gte(P.createdAt, since), eq(P.status, "published"))),
    db().select({ n: count() }).from(C).where(and(gte(C.createdAt, since), eq(C.status, "published"))),
    db().select({ n: count() }).from(R).where(eq(R.status, "open")),
    db().select({ id: Log.id, action: Log.action, targetType: Log.targetType, targetId: Log.targetId, meta: Log.meta, createdAt: Log.createdAt, actor: users.name, actorEmail: users.email }).from(Log).leftJoin(users, eq(users.id, Log.actorId)).orderBy(desc(Log.createdAt), desc(Log.id)).limit(50),
  ]);
  return { communities: c.n, members: m.n, posts7: p.n, comments7: cm.n, openReports: r.n, log: entries };
}

// ---------------------------------------------------------------- communities

export type AdminCommunity = CommunityRow & { members: number; posts: number };

export async function listAdminCommunities(viewer: Viewer): Promise<AdminCommunity[]> {
  requireSuper(viewer);
  const [rows, counts, posts] = await Promise.all([
    db().select().from(communities).orderBy(asc(communities.sortOrder), asc(communities.name)),
    memberCounts(),
    db().select({ id: P.communityId, n: count() }).from(P).where(eq(P.status, "published")).groupBy(P.communityId),
  ]);
  const pc = new Map(posts.map((r) => [r.id, r.n]));
  return rows.map((c) => ({ ...c, members: counts.get(c.id) ?? 0, posts: pc.get(c.id) ?? 0 }));
}

export type CommunityInput = { slug?: unknown; name?: unknown; description?: unknown; iconUrl?: unknown; coverUrl?: unknown; visibility?: unknown; joinMode?: unknown; status?: unknown; defaultSort?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const mediaUrl = (v: unknown) => {
  const s = str(v, 600);
  return s && (s.startsWith("/api/forms/media/") || /^https:\/\//.test(s)) ? s : null;
};

export async function createCommunity(viewer: Viewer, input: CommunityInput): Promise<CommunityRow> {
  unwrap(canManageCommunities(viewer.actor));
  const slug = str(input.slug, 60).toLowerCase();
  const name = str(input.name, 80);
  if (!name) throw invalid("Give the community a name.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw invalid("Use lowercase letters, numbers and hyphens in the address.");
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) throw new CommunityError(400, "That address is reserved.");
  try {
    const [row] = await db()
      .insert(communities)
      .values({
        slug,
        name,
        description: str(input.description, 600) || null,
        iconUrl: mediaUrl(input.iconUrl),
        coverUrl: mediaUrl(input.coverUrl),
        visibility: oneOf(input.visibility, VISIBILITY, "listed"),
        joinMode: oneOf(input.joinMode, JOIN_MODES, "open"),
        status: oneOf(input.status, COMMUNITY_STATUS, "active"),
        createdBy: viewer.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    await log(viewer.user.id, "community.create", "community", row.id, { slug });
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new CommunityError(409, "That address is taken.");
    throw e;
  }
}

/** The slug is immutable and is not read here. */
export async function updateCommunity(viewer: Viewer, id: number, input: CommunityInput): Promise<CommunityRow> {
  unwrap(canManageCommunities(viewer.actor));
  const c = await getCommunityById(id);
  if (!c) throw notFound();
  const set: Partial<typeof communities.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = str(input.name, 80);
    if (!name) throw invalid("Give the community a name.");
    set.name = name;
  }
  if (input.description !== undefined) set.description = str(input.description, 600) || null;
  if (input.iconUrl !== undefined) set.iconUrl = mediaUrl(input.iconUrl);
  if (input.coverUrl !== undefined) set.coverUrl = mediaUrl(input.coverUrl);
  if (input.visibility !== undefined) set.visibility = oneOf(input.visibility, VISIBILITY, c.visibility as "listed");
  if (input.defaultSort !== undefined && (SORT_RULES as readonly string[]).includes(input.defaultSort as string)) set.defaultSort = input.defaultSort as string;
  if (input.joinMode !== undefined) set.joinMode = oneOf(input.joinMode, JOIN_MODES, c.joinMode as "open");
  if (input.status !== undefined) {
    const status = oneOf(input.status, COMMUNITY_STATUS, c.status as "active");
    if (c.isDefault && status === "archived") throw invalid("Make another community the default before archiving this one.");
    set.status = status;
  }
  if (c.isDefault && set.visibility === "hidden") throw invalid("The default community has to stay listed.");
  const [row] = await db().update(communities).set(set).where(eq(communities.id, id)).returning();
  await log(viewer.user.id, "community.update", "community", id, { fields: Object.keys(set).filter((k) => k !== "updatedAt") });
  return row;
}

/** Moves the default flag. The partial unique index allows one true row, so the old one is cleared first. */
export async function setDefaultCommunity(viewer: Viewer, id: number) {
  unwrap(canManageCommunities(viewer.actor));
  const c = await getCommunityById(id);
  if (!c) throw notFound();
  if (c.status === "archived" || c.visibility === "hidden") throw invalid("The default community has to be active and listed.");
  const [prev] = await db().select({ id: communities.id }).from(communities).where(eq(communities.isDefault, true)).limit(1);
  if (prev?.id === id) return;
  await db().update(communities).set({ isDefault: false }).where(and(eq(communities.isDefault, true), ne(communities.id, id)));
  try {
    await db().update(communities).set({ isDefault: true, updatedAt: new Date() }).where(eq(communities.id, id));
  } catch (e) {
    if (prev) await db().update(communities).set({ isDefault: true }).where(eq(communities.id, prev.id));
    throw e;
  }
  await log(viewer.user.id, "community.set_default", "community", id, { previous: prev?.id ?? null });
}

export async function reorderCommunities(viewer: Viewer, ids: number[]) {
  unwrap(canManageCommunities(viewer.actor));
  for (const [i, id] of ids.entries()) await db().update(communities).set({ sortOrder: i }).where(eq(communities.id, id));
  await log(viewer.user.id, "community.reorder", "community", "-", { ids });
}

// ---------------------------------------------------------------- members

export type MemberRowDTO = { userId: string; name: string; username: string; email: string; role: string; status: string; bannedReason: string; joinedAt: string };

export async function listMembers(viewer: Viewer, communityId: number, opts: { q?: string; status?: string }): Promise<MemberRowDTO[]> {
  await assertModerates(viewer, communityId);
  const q = (opts.q ?? "").trim();
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db()
    .select({ m: Mem, name: users.name, username: users.username, email: users.email })
    .from(Mem)
    .innerJoin(users, eq(users.id, Mem.userId))
    .where(and(eq(Mem.communityId, communityId), opts.status ? eq(Mem.status, opts.status) : undefined, q ? or(ilike(users.name, like), ilike(users.username, like), viewer.actor.superAdmin ? ilike(users.email, like) : undefined) : undefined))
    .orderBy(asc(users.name))
    .limit(300);
  return rows.map((r) => ({ userId: r.m.userId, name: r.name || r.username || "Member", username: r.username ?? "", email: viewer.actor.superAdmin ? r.email : "", role: r.m.role, status: r.m.status, bannedReason: r.m.bannedReason ?? "", joinedAt: r.m.joinedAt.toISOString() }));
}

export async function searchUsers(viewer: Viewer, q: string) {
  requireSuper(viewer);
  const s = q.trim();
  if (s.length < 2) return [];
  const like = `%${s.replace(/[\\%_]/g, "\\$&")}%`;
  return db().select({ id: users.id, name: users.name, username: users.username, email: users.email }).from(users).where(and(eq(users.status, "active"), or(ilike(users.name, like), ilike(users.email, like), ilike(users.username, like)))).orderBy(asc(users.name)).limit(10);
}

export async function addMember(viewer: Viewer, communityId: number, userId: string) {
  unwrap(canManageCommunities(viewer.actor));
  if (!isUuid(userId) || !(await getCommunityById(communityId))) throw notFound();
  await db().insert(Mem).values({ communityId, userId, role: "member", status: "active", joinedAt: new Date() }).onConflictDoNothing();
  clearMemberCounts();
  await log(viewer.user.id, "member.add", "community", communityId, { userId });
}

export async function removeMember(viewer: Viewer, communityId: number, userId: string) {
  unwrap(canManageCommunities(viewer.actor));
  const c = await getCommunityById(communityId);
  if (!c) throw notFound();
  if (c.isDefault) throw invalid("People can't be removed from the default community. Ban them instead.");
  await db().delete(Mem).where(and(eq(Mem.communityId, communityId), eq(Mem.userId, userId)));
  clearMemberCounts();
  await log(viewer.user.id, "member.remove", "community", communityId, { userId });
}

export async function setModerator(viewer: Viewer, communityId: number, userId: string, moderator: boolean) {
  unwrap(canAssignModerators(viewer.actor));
  const m = await getMembership(communityId, userId);
  if (!m) throw notFound();
  if (m.status === "banned") throw invalid("Unban this member first.");
  await db().update(Mem).set({ role: moderator ? "moderator" : "member" }).where(eq(Mem.id, m.id));
  await log(viewer.user.id, moderator ? "member.make_moderator" : "member.remove_moderator", "community", communityId, { userId });
}

export async function banMember(viewer: Viewer, communityId: number, userId: string, reason: string) {
  const c = await getCommunityById(communityId);
  if (!c) throw notFound();
  await assertModerates(viewer, communityId);
  const mine = await getMembership(communityId, viewer.user.id);
  unwrap(canBan(viewer.actor, memberState(mine), communityState(c)));
  if (userId === viewer.user.id) throw invalid("You can't ban yourself.");
  const target = await getMembership(communityId, userId);
  if (target?.role === "moderator" && !viewer.actor.superAdmin) throw forbidden();
  const now = new Date();
  const base = { status: "banned", bannedReason: reason.trim().slice(0, 300) || null, bannedAt: now, bannedBy: viewer.user.id, role: "member" };
  if (target) await db().update(Mem).set(base).where(eq(Mem.id, target.id));
  else await db().insert(Mem).values({ communityId, userId, joinedAt: now, ...base });
  clearMemberCounts();
  await log(viewer.user.id, "member.ban", "community", communityId, { userId, reason: base.bannedReason });
}

export async function unbanMember(viewer: Viewer, communityId: number, userId: string) {
  const c = await getCommunityById(communityId);
  if (!c) throw notFound();
  await assertModerates(viewer, communityId);
  const mine = await getMembership(communityId, viewer.user.id);
  unwrap(canBan(viewer.actor, memberState(mine), communityState(c)));
  await db().update(Mem).set({ status: "active", bannedReason: null, bannedAt: null, bannedBy: null }).where(and(eq(Mem.communityId, communityId), eq(Mem.userId, userId)));
  clearMemberCounts();
  await log(viewer.user.id, "member.unban", "community", communityId, { userId });
}

// ---------------------------------------------------------------- reports

export type ReportDTO = {
  id: number;
  status: string;
  targetType: string;
  targetId: string;
  communityId: number | null;
  communityName: string;
  reason: string;
  details: string;
  reporter: string;
  createdAt: string;
  preview: string;
  href: string;
  targetStatus: string;
  targetUserId: string;
  targetUserName: string;
  snapshot: string;
  resolution: string;
  canAct: boolean;
  thumb: string;
};

export async function listReports(viewer: Viewer, f: { status?: string; type?: string; communityId?: number | null }): Promise<ReportDTO[]> {
  const ids = await moderatedIds(viewer);
  if (ids !== "all" && !ids.length) throw forbidden();
  const rows = await db()
    .select({ r: R, reporter: users.name, reporterEmail: users.email })
    .from(R)
    .innerJoin(users, eq(users.id, R.reporterId))
    .where(and(f.status ? eq(R.status, f.status) : undefined, f.type ? eq(R.targetType, f.type) : undefined, f.communityId ? eq(R.communityId, f.communityId) : undefined, ids === "all" ? undefined : inArray(R.communityId, ids)))
    .orderBy(desc(R.createdAt), desc(R.id))
    .limit(200);
  const postIds = rows.filter((x) => x.r.targetType === "post").map((x) => Number(x.r.targetId));
  const commentIds = rows.filter((x) => x.r.targetType === "comment").map((x) => Number(x.r.targetId));
  const userIds = rows.filter((x) => x.r.targetType === "user").map((x) => x.r.targetId);
  const msgIds = rows.filter((x) => x.r.targetType === "message").map((x) => Number(x.r.targetId));
  const commIds = [...new Set(rows.map((x) => x.r.communityId).filter((x): x is number => !!x))];
  const [posts, comments, targets, msgs, comms] = await Promise.all([
    postIds.length ? db().select({ id: P.id, body: P.body, status: P.status, authorId: P.authorId, name: users.name }).from(P).innerJoin(users, eq(users.id, P.authorId)).where(inArray(P.id, postIds)) : [],
    commentIds.length ? db().select({ id: C.id, body: C.body, status: C.status, postId: C.postId, authorId: C.authorId, name: users.name }).from(C).innerJoin(users, eq(users.id, C.authorId)).where(inArray(C.id, commentIds)) : [],
    userIds.length ? db().select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [],
    msgIds.length ? db().select({ id: Msg.id, senderId: Msg.senderId, name: users.name }).from(Msg).innerJoin(users, eq(users.id, Msg.senderId)).where(inArray(Msg.id, msgIds)) : [],
    commIds.length ? db().select({ id: communities.id, name: communities.name, slug: communities.slug }).from(communities).where(inArray(communities.id, commIds)) : [],
  ]);
  const media = await mediaFor(postIds);
  const pm = new Map(posts.map((x) => [x.id, x]));
  const cm = new Map(comments.map((x) => [x.id, x]));
  const um = new Map(targets.map((x) => [x.id, x]));
  const mm = new Map(msgs.map((x) => [x.id, x]));
  const com = new Map(comms.map((x) => [x.id, x]));
  return rows.map(({ r, reporter }) => {
    const c = r.communityId ? com.get(r.communityId) : undefined;
    let preview = "";
    let href = "";
    let targetStatus = "";
    let targetUserId = "";
    let targetUserName = "";
    let thumb = "";
    if (r.targetType === "post") {
      thumb = media.get(Number(r.targetId))?.[0]?.url ?? "";
      const p = pm.get(Number(r.targetId));
      preview = p ? snippet(p.body, 200) : "(removed)";
      targetStatus = p?.status ?? "deleted";
      targetUserId = p?.authorId ?? "";
      targetUserName = p?.name ?? "";
      href = c ? `/community/${c.slug}/post/${r.targetId}` : "";
    } else if (r.targetType === "comment") {
      const x = cm.get(Number(r.targetId));
      preview = x ? snippet(x.body, 200) : "(removed)";
      targetStatus = x?.status ?? "deleted";
      targetUserId = x?.authorId ?? "";
      targetUserName = x?.name ?? "";
      href = c && x ? `/community/${c.slug}/post/${x.postId}#comment-${r.targetId}` : "";
    } else if (r.targetType === "user") {
      const u = um.get(r.targetId);
      preview = u ? u.name || "Member" : "(removed)";
      targetUserId = r.targetId;
      targetUserName = u?.name ?? "";
      href = `/community/u/${r.targetId}`;
    } else {
      const m = mm.get(Number(r.targetId));
      targetUserId = m?.senderId ?? "";
      targetUserName = m?.name ?? "";
      preview = "Message (see copy below)";
    }
    return {
      id: r.id,
      status: r.status,
      targetType: r.targetType,
      targetId: r.targetId,
      communityId: r.communityId,
      communityName: c?.name ?? "",
      reason: r.reason,
      details: r.details ?? "",
      reporter: reporter || "Member",
      createdAt: r.createdAt.toISOString(),
      preview,
      href,
      targetStatus,
      targetUserId,
      targetUserName,
      snapshot: viewer.actor.superAdmin ? (r.messageSnapshot ?? "") : "",
      resolution: r.resolutionNote ?? "",
      thumb,
      canAct: r.status === "open",
    };
  });
}

/** Applies one action to a report and to every other open report on the same thing. */
export async function resolveReport(viewer: Viewer, reportId: number, action: ReportAction, note: string) {
  if (!REPORT_ACTIONS.includes(action)) throw invalid();
  const [r] = await db().select().from(R).where(eq(R.id, reportId)).limit(1);
  if (!r) throw notFound();
  if (r.status !== "open") throw new CommunityError(409, "This report is already resolved.");
  let scopeMember = null;
  if (r.communityId) {
    await assertModerates(viewer, r.communityId);
    scopeMember = await getMembership(r.communityId, viewer.user.id);
    unwrap(canSeeReports(viewer.actor, memberState(scopeMember)));
  } else {
    requireSuper(viewer);
  }

  // who wrote the thing
  let authorId = "";
  if (r.targetType === "post") authorId = (await getPostRow(Number(r.targetId)))?.authorId ?? "";
  else if (r.targetType === "comment") authorId = (await getCommentRow(Number(r.targetId)))?.authorId ?? "";
  else if (r.targetType === "user") authorId = r.targetId;
  else authorId = (await db().select({ s: Msg.senderId }).from(Msg).where(eq(Msg.id, Number(r.targetId))).limit(1))[0]?.s ?? "";

  if (action === "hide" || action === "delete") {
    const status = action === "hide" ? "hidden_by_mod" : "deleted";
    if (r.targetType === "post" && r.communityId) {
      const post = await getPostRow(Number(r.targetId));
      if (post && post.status !== "deleted" && post.status !== status) await setPostStatus(await scopeById(viewer, r.communityId), post, status);
    } else if (r.targetType === "comment" && r.communityId) {
      const comment = await getCommentRow(Number(r.targetId));
      if (comment && comment.status !== "deleted" && comment.status !== status) await setCommentStatus(await scopeById(viewer, r.communityId), comment, status);
    } else if (r.targetType === "message") {
      requireSuper(viewer);
      await db().update(Msg).set({ status: "deleted", deletedAt: new Date() }).where(eq(Msg.id, Number(r.targetId)));
    } else throw invalid("There is no content to remove on this report.");
  } else if (action === "ban") {
    if (!r.communityId || !authorId) throw invalid("Ban applies to content in a community.");
    await banMember(viewer, r.communityId, authorId, note || `Report #${r.id}`);
  } else if (action === "suspend") {
    requireSuper(viewer);
    if (!authorId) throw invalid();
    await suspendUser(viewer.user.id, authorId, note || `Report #${r.id}`);
  }

  const status = action === "dismiss" ? "dismissed" : "resolved";
  const noteText = [action, note.trim().slice(0, 300)].filter(Boolean).join(": ");
  await db()
    .update(R)
    .set({ status, resolvedBy: viewer.user.id, resolvedAt: new Date(), resolutionNote: noteText })
    .where(and(eq(R.targetType, r.targetType), eq(R.targetId, r.targetId), eq(R.status, "open")));
  await log(viewer.user.id, `report.${action}`, "report", reportId, { targetType: r.targetType, targetId: r.targetId });
}

// ---------------------------------------------------------------- content tools

export type ContentRow = { kind: "post" | "comment"; id: number; postId: number; author: string; snippet: string; status: string; createdAt: string; thumb?: string; imageCount?: number };

export async function searchContent(viewer: Viewer, communityId: number, q: string): Promise<ContentRow[]> {
  await assertModerates(viewer, communityId);
  const s = q.trim();
  const id = /^\d{1,9}$/.test(s) ? Number(s) : null;
  const like = `%${s.replace(/[\\%_]/g, "\\$&")}%`;
  const posts = await db()
    .select({ id: P.id, body: P.body, status: P.status, createdAt: P.createdAt, name: users.name })
    .from(P)
    .innerJoin(users, eq(users.id, P.authorId))
    .where(and(eq(P.communityId, communityId), s ? or(id ? eq(P.id, id) : undefined, ilike(P.body, like)) : undefined))
    .orderBy(desc(P.createdAt))
    .limit(25);
  const comments = await db()
    .select({ id: C.id, postId: C.postId, body: C.body, status: C.status, createdAt: C.createdAt, name: users.name })
    .from(C)
    .innerJoin(users, eq(users.id, C.authorId))
    .where(and(eq(C.communityId, communityId), s ? or(id ? eq(C.id, id) : undefined, ilike(C.body, like)) : undefined))
    .orderBy(desc(C.createdAt))
    .limit(25);
  const media = await mediaFor(posts.map((p) => p.id));
  return [
    ...posts.map((p): ContentRow => ({ kind: "post", id: p.id, postId: p.id, author: p.name || "Member", snippet: snippet(p.body, 160), status: p.status, createdAt: p.createdAt.toISOString(), thumb: media.get(p.id)?.[0]?.url, imageCount: media.get(p.id)?.length ?? 0 })),
    ...comments.map((c): ContentRow => ({ kind: "comment", id: c.id, postId: c.postId, author: c.name || "Member", snippet: snippet(c.body, 160), status: c.status, createdAt: c.createdAt.toISOString() })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function moderateContent(viewer: Viewer, kind: "post" | "comment", id: number, status: "hidden_by_mod" | "deleted" | "published") {
  if (kind === "post") {
    const post = await getPostRow(id);
    if (!post) throw notFound();
    await assertModerates(viewer, post.communityId);
    await setPostStatus(await scopeById(viewer, post.communityId), post, status);
  } else {
    const comment = await getCommentRow(id);
    if (!comment) throw notFound();
    await assertModerates(viewer, comment.communityId);
    await setCommentStatus(await scopeById(viewer, comment.communityId), comment, status);
  }
  await log(viewer.user.id, `content.${status}`, kind, id);
}

// ---------------------------------------------------------------- settings

export type SettingsInput = { postingPaused?: unknown; maxImagesPerPost?: unknown; maxImageMb?: unknown; ratePostPerHour?: unknown; rateCommentPerHour?: unknown; rateMessagePerMinute?: unknown };
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export async function updateSettings(viewer: Viewer, input: SettingsInput) {
  requireSuper(viewer);
  const cur = await getSettings();
  const next = {
    postingPaused: typeof input.postingPaused === "boolean" ? input.postingPaused : cur.postingPaused,
    maxImagesPerPost: int(input.maxImagesPerPost, 0, 10, cur.maxImagesPerPost),
    maxImageMb: int(input.maxImageMb, 1, 25, cur.maxImageMb),
    ratePostPerHour: int(input.ratePostPerHour, 1, 1000, cur.ratePostPerHour),
    rateCommentPerHour: int(input.rateCommentPerHour, 1, 5000, cur.rateCommentPerHour),
    rateMessagePerMinute: int(input.rateMessagePerMinute, 1, 600, cur.rateMessagePerMinute),
  };
  await db().update(Set_).set({ ...next, updatedBy: viewer.user.id, updatedAt: new Date() }).where(eq(Set_.id, 1));
  clearSettingsCache();
  await log(viewer.user.id, "settings.update", "settings", 1, next);
}
