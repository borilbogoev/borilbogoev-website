// Blocks, reports and suspensions.
import { and, desc, eq, isNull } from "drizzle-orm";
import { schema } from "@/db";
import { REPORT_REASONS, REPORT_TARGETS, LIMITS, type ReportReason, type ReportTarget } from "../lib/constants";
import { CommunityError, db, forbidden, invalid, isUniqueViolation, isUuid, notFound, toId } from "./core";
import { getCommunityById, getMembership, communityState, memberState, type Viewer } from "./context";
import { canBlock, canReport } from "./permissions";
import { unwrap } from "./posts";

const { communityBlocks: B, communityReports: R, communityPosts: P, communityComments: C, communityMessages: Msg, communityParticipants: Part, communitySuspensions: S, users } = schema;

// ---------------------------------------------------------------- blocks

export async function blockUser(viewer: Viewer, targetId: string) {
  unwrap(canBlock(viewer.actor, targetId));
  const [u] = await db().select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
  if (!u) throw notFound();
  await db().insert(B).values({ blockerId: viewer.user.id, blockedId: targetId, createdAt: new Date() }).onConflictDoNothing();
}
export async function unblockUser(viewer: Viewer, targetId: string) {
  if (!isUuid(targetId)) throw notFound();
  await db().delete(B).where(and(eq(B.blockerId, viewer.user.id), eq(B.blockedId, targetId)));
}
/** True when `blockerId` has blocked `blockedId`. */
export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const [r] = await db().select({ id: B.id }).from(B).where(and(eq(B.blockerId, blockerId), eq(B.blockedId, blockedId))).limit(1);
  return !!r;
}

// ---------------------------------------------------------------- reports

export type ReportInput = { targetType: unknown; targetId: unknown; reason: unknown; details?: unknown };

export async function createReport(viewer: Viewer, input: ReportInput) {
  const type = input.targetType as ReportTarget;
  const reason = input.reason as ReportReason;
  if (!REPORT_TARGETS.includes(type) || !REPORT_REASONS.includes(reason)) throw invalid();
  const details = typeof input.details === "string" ? input.details.trim().slice(0, LIMITS.reportDetails) : "";
  let targetId = "";
  let communityId: number | null = null;
  let messageSnapshot: string | null = null;

  if (type === "user") {
    if (!isUuid(input.targetId) || input.targetId === viewer.user.id) throw invalid();
    const [u] = await db().select({ id: users.id }).from(users).where(eq(users.id, input.targetId)).limit(1);
    if (!u) throw notFound();
    targetId = input.targetId;
  } else {
    const id = toId(input.targetId);
    if (!id) throw invalid();
    targetId = String(id);
    if (type === "post" || type === "comment") {
      const [row] =
        type === "post"
          ? await db().select({ communityId: P.communityId, authorId: P.authorId, status: P.status }).from(P).where(eq(P.id, id)).limit(1)
          : await db().select({ communityId: C.communityId, authorId: C.authorId, status: C.status }).from(C).where(eq(C.id, id)).limit(1);
      if (!row || row.status === "deleted") throw notFound();
      if (row.authorId === viewer.user.id) throw forbidden("You can't report your own content.");
      const community = await getCommunityById(row.communityId);
      if (!community) throw notFound();
      const d = canReport(viewer.actor, memberState(await getMembership(community.id, viewer.user.id)), communityState(community));
      if (!d.ok) throw notFound();
      communityId = community.id;
    } else {
      // A message can only be reported by the other person in the conversation; the body is copied now.
      const [m] = await db().select({ body: Msg.body, senderId: Msg.senderId, status: Msg.status, conversationId: Msg.conversationId }).from(Msg).where(eq(Msg.id, id)).limit(1);
      if (!m || m.status !== "sent") throw notFound();
      const [mine] = await db().select({ id: Part.id }).from(Part).where(and(eq(Part.conversationId, m.conversationId), eq(Part.userId, viewer.user.id))).limit(1);
      if (!mine || m.senderId === viewer.user.id) throw notFound();
      messageSnapshot = m.body.slice(0, 4000);
      const d = canReport(viewer.actor, null, null);
      unwrap(d);
    }
  }
  if (viewer.actor.suspended && !viewer.actor.superAdmin) throw forbidden("Your Community access is read only.");
  try {
    await db().insert(R).values({ reporterId: viewer.user.id, targetType: type, targetId, communityId, reason, details: details || null, messageSnapshot, createdAt: new Date() });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CommunityError(409, "You already reported this.");
    throw e;
  }
}

// ---------------------------------------------------------------- suspensions

export async function listSuspensions() {
  return db()
    .select({ id: S.id, userId: S.userId, name: users.name, email: users.email, reason: S.reason, createdAt: S.createdAt, liftedAt: S.liftedAt })
    .from(S)
    .innerJoin(users, eq(users.id, S.userId))
    .orderBy(desc(S.createdAt))
    .limit(200);
}
export async function suspendUser(actorId: string, userId: string, reason: string) {
  const [open] = await db().select({ id: S.id }).from(S).where(and(eq(S.userId, userId), isNull(S.liftedAt))).limit(1);
  if (open) return open.id;
  const [row] = await db().insert(S).values({ userId, reason: reason.slice(0, 500) || null, createdBy: actorId, createdAt: new Date() }).returning({ id: S.id });
  return row.id;
}
export async function liftSuspension(id: number) {
  await db().update(S).set({ liftedAt: new Date() }).where(and(eq(S.id, id), isNull(S.liftedAt)));
}
