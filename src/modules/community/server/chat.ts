// 1-1 chat. Private to the two people: nobody else, admins included, can read a conversation.
import { and, desc, eq, lt, gt, or, sql, asc } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS } from "../lib/constants";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { cleanBody, snippet } from "../lib/text";
import { CommunityError, db, forbidden, invalid, isUniqueViolation, isUuid, notFound, run, asDate } from "./core";
import type { Viewer } from "./context";
import { resolveMentions, writeMentions } from "./mentions";
import { canDirectMessage } from "./permissions";
import { loadPeople, loadPeopleFor, type People } from "./people";
import { checkRate } from "./rate";
import { hasBlocked } from "./safety";

const { communityConversations: Conv, communityParticipants: Part, communityMessages: Msg, users } = schema;

export const dmKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const GENERIC = "You can't message this user";

export type MessageDTO = { id: number; conversationId: number; senderId: string; body: string; deleted: boolean; createdAt: string; cursor: string; mine: boolean };

const toMessage = (m: typeof Msg.$inferSelect, me: string): MessageDTO => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  body: m.status === "deleted" ? "" : m.body,
  deleted: m.status === "deleted",
  createdAt: m.createdAt.toISOString(),
  cursor: encodeCursor(m),
  mine: m.senderId === me,
});

/** The conversation, but only for its participants. Anyone else gets "not found". */
export async function getParticipantConversation(viewer: Viewer, id: number) {
  const [row] = await db()
    .select({ conv: Conv, readAt: Part.lastReadAt })
    .from(Part)
    .innerJoin(Conv, eq(Conv.id, Part.conversationId))
    .where(and(eq(Part.conversationId, id), eq(Part.userId, viewer.user.id)))
    .limit(1);
  if (!row) throw notFound();
  const [other] = await db().select({ userId: Part.userId }).from(Part).where(and(eq(Part.conversationId, id), sql`${Part.userId} <> ${viewer.user.id}`)).limit(1);
  return { ...row, otherId: other?.userId ?? "" };
}

/** Get or create the one direct conversation for a pair. Safe under a race: the loser reads the winner's row. */
export async function openConversation(viewer: Viewer, targetId: string): Promise<number> {
  if (!isUuid(targetId)) throw notFound();
  const [target] = await db().select({ id: users.id, status: users.status }).from(users).where(eq(users.id, targetId)).limit(1);
  if (!target || target.status !== "active") throw notFound();
  const blockedByTarget = await hasBlocked(targetId, viewer.user.id);
  const d = canDirectMessage(viewer.actor, target, { blockedByTarget });
  if (!d.ok) throw forbidden(d.code === "forbidden" && targetId === viewer.user.id ? "You can't message yourself." : GENERIC);
  const key = dmKey(viewer.user.id, targetId);
  const find = async () => (await db().select({ id: Conv.id }).from(Conv).where(eq(Conv.dmKey, key)).limit(1))[0]?.id;
  const existing = await find();
  if (existing) return existing;
  const now = new Date();
  try {
    await run(sql`
      WITH c AS (INSERT INTO community_conversations (type, dm_key, created_at) VALUES ('direct', ${key}, ${now}) ON CONFLICT (dm_key) DO NOTHING RETURNING id)
      INSERT INTO community_conversation_participants (conversation_id, user_id, created_at)
      SELECT id, ${viewer.user.id}::uuid, ${now}::timestamptz FROM c UNION ALL SELECT id, ${targetId}::uuid, ${now}::timestamptz FROM c`);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
  const id = await find();
  if (!id) throw new CommunityError(409, "Try again.");
  return id;
}

export type ConversationDTO = { id: number; otherId: string; lastMessage: { body: string; mine: boolean; deleted: boolean; createdAt: string } | null; lastMessageAt: string | null; unread: boolean };

export async function listConversations(viewer: Viewer): Promise<{ items: ConversationDTO[]; people: People }> {
  const me = viewer.user.id;
  const rows = await run<{ id: number; other_id: string; last_message_at: unknown; body: string | null; sender_id: string | null; status: string | null; msg_at: unknown; unread: boolean }>(sql`
    SELECT c.id, other.user_id AS other_id, c.last_message_at, m.body, m.sender_id, m.status, m.created_at AS msg_at,
      EXISTS (SELECT 1 FROM community_messages x WHERE x.conversation_id = c.id AND x.sender_id <> ${me} AND x.status = 'sent' AND (mine.last_read_at IS NULL OR x.created_at > mine.last_read_at)) AS unread
    FROM community_conversation_participants mine
    JOIN community_conversations c ON c.id = mine.conversation_id
    JOIN community_conversation_participants other ON other.conversation_id = c.id AND other.user_id <> ${me}
    LEFT JOIN LATERAL (SELECT body, sender_id, status, created_at FROM community_messages WHERE conversation_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1) m ON true
    WHERE mine.user_id = ${me} AND c.last_message_at IS NOT NULL
    ORDER BY c.last_message_at DESC LIMIT 100`);
  const items = rows.map((r) => ({
    id: r.id,
    otherId: r.other_id,
    lastMessageAt: r.last_message_at ? asDate(r.last_message_at).toISOString() : null,
    lastMessage: r.sender_id ? { body: r.status === "deleted" ? "" : snippet(r.body ?? "", 90), mine: r.sender_id === me, deleted: r.status === "deleted", createdAt: asDate(r.msg_at).toISOString() } : null,
    unread: !!r.unread,
  }));
  return { items, people: await loadPeople(items.map((i) => i.otherId)) };
}

export async function unreadConversations(viewer: Viewer): Promise<number> {
  const me = viewer.user.id;
  const [r] = await run<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM community_conversation_participants mine
    WHERE mine.user_id = ${me} AND EXISTS (SELECT 1 FROM community_messages x WHERE x.conversation_id = mine.conversation_id AND x.sender_id <> ${me} AND x.status = 'sent' AND (mine.last_read_at IS NULL OR x.created_at > mine.last_read_at))`);
  return r?.n ?? 0;
}

/** Older messages for a page (`cursor`), or newer ones for polling (`after`). Always returned oldest first. */
export async function listMessages(viewer: Viewer, conversationId: number, opts: { cursor?: string | null; after?: string | null }) {
  await getParticipantConversation(viewer, conversationId);
  const after = decodeCursor(opts.after);
  const cur = decodeCursor(opts.cursor);
  const limit = after ? 100 : LIMITS.messagePage;
  const rows = await db()
    .select()
    .from(Msg)
    .where(
      and(
        eq(Msg.conversationId, conversationId),
        after ? or(gt(Msg.createdAt, after.at), and(eq(Msg.createdAt, after.at), gt(Msg.id, after.id))) : undefined,
        !after && cur ? or(lt(Msg.createdAt, cur.at), and(eq(Msg.createdAt, cur.at), lt(Msg.id, cur.id))) : undefined,
      ),
    )
    .orderBy(after ? asc(Msg.createdAt) : desc(Msg.createdAt), after ? asc(Msg.id) : desc(Msg.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items = page.map((m) => toMessage(m, viewer.user.id));
  if (!after) items.reverse();
  const people = await loadPeopleFor([], items.map((i) => i.body));
  return { items, people, nextCursor: !after && rows.length > limit ? encodeCursor(page[page.length - 1]) : null };
}

export async function sendMessage(viewer: Viewer, conversationId: number, input: { body: unknown; requestId?: string | null }) {
  const { otherId } = await getParticipantConversation(viewer, conversationId);
  const blockedByTarget = await hasBlocked(otherId, viewer.user.id);
  const d = canDirectMessage(viewer.actor, { id: otherId }, { blockedByTarget });
  if (!d.ok) throw forbidden(GENERIC);
  const body = cleanBody(input.body);
  if (!body) throw invalid("Write something first.");
  if (body.length > LIMITS.messageBody) throw invalid(`That is too long. The limit is ${LIMITS.messageBody} characters.`);
  const requestId = typeof input.requestId === "string" && input.requestId.length <= 64 ? input.requestId : null;
  if (requestId) {
    const [dup] = await db().select().from(Msg).where(and(eq(Msg.senderId, viewer.user.id), eq(Msg.requestId, requestId))).limit(1);
    if (dup) return { item: toMessage(dup, viewer.user.id), duplicate: true };
  }
  await checkRate(viewer, "message");
  const mentions = await resolveMentions({ body, authorId: viewer.user.id, communityId: null });
  const now = new Date();
  let id: number;
  try {
    const [row] = await run<{ id: number }>(sql`
      WITH m AS (
        INSERT INTO community_messages (conversation_id, sender_id, body, request_id, created_at) VALUES (${conversationId}, ${viewer.user.id}, ${mentions.body}, ${requestId}, ${now}) RETURNING id
      ), c AS (
        UPDATE community_conversations SET last_message_at = ${now} WHERE id = ${conversationId} RETURNING id
      ), r AS (
        UPDATE community_conversation_participants SET last_read_at = ${now} WHERE conversation_id = ${conversationId} AND user_id = ${viewer.user.id} RETURNING id
      )
      SELECT id FROM m`);
    id = row.id;
  } catch (e) {
    if (isUniqueViolation(e) && requestId) {
      const [dup] = await db().select().from(Msg).where(and(eq(Msg.senderId, viewer.user.id), eq(Msg.requestId, requestId))).limit(1);
      if (dup) return { item: toMessage(dup, viewer.user.id), duplicate: true };
    }
    throw e;
  }
  await writeMentions({ sourceType: "message", sourceId: id, communityId: null, authorId: viewer.user.id, ids: mentions.ids });
  const [row] = await db().select().from(Msg).where(eq(Msg.id, id)).limit(1);
  return { item: toMessage(row, viewer.user.id), duplicate: false };
}

export async function markConversationRead(viewer: Viewer, conversationId: number) {
  await getParticipantConversation(viewer, conversationId);
  await db().update(Part).set({ lastReadAt: new Date() }).where(and(eq(Part.conversationId, conversationId), eq(Part.userId, viewer.user.id)));
}

export async function deleteMessage(viewer: Viewer, messageId: number) {
  const [m] = await db().select().from(Msg).where(eq(Msg.id, messageId)).limit(1);
  if (!m || m.senderId !== viewer.user.id || m.status === "deleted") throw notFound();
  await db().update(Msg).set({ status: "deleted", deletedAt: new Date() }).where(eq(Msg.id, messageId));
}


