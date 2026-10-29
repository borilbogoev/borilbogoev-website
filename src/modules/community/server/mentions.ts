// Mentions, built once for posts, comments and messages.
//   resolveMentions: before saving, keep only valid tokens, rewrite the rest to plain @Name.
//   writeMentions:   after saving, diff the stored rows and notify the newly mentioned.
import { and, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import { LIMITS } from "../lib/constants";
import { neutralizeMentions, parseMentions } from "../lib/text";
import { db } from "./core";

const { communityMembers, communityMentions, communityNotifications, communityBlocks, users } = schema;

export type SourceType = "post" | "comment" | "message";

export async function resolveMentions(input: { body: string; authorId: string; communityId: number | null }): Promise<{ body: string; ids: string[] }> {
  const tokens = parseMentions(input.body, LIMITS.mentionsPerItem).filter((m) => m.userId !== input.authorId);
  const wanted = tokens.map((m) => m.userId);
  let valid = new Set<string>();
  if (wanted.length) {
    if (input.communityId !== null) {
      const rows = await db()
        .select({ id: communityMembers.userId })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.status, "active"), inArray(communityMembers.userId, wanted)));
      valid = new Set(rows.map((r) => r.id));
    } else {
      const [exist, blockedMe] = await Promise.all([
        db().select({ id: users.id }).from(users).where(and(inArray(users.id, wanted), eq(users.status, "active"))),
        db().select({ id: communityBlocks.blockerId }).from(communityBlocks).where(and(eq(communityBlocks.blockedId, input.authorId), inArray(communityBlocks.blockerId, wanted))),
      ]);
      const no = new Set(blockedMe.map((r) => r.id));
      valid = new Set(exist.map((r) => r.id).filter((id) => !no.has(id)));
    }
  }
  // Tokens beyond the cap, for self and for strangers all fall back to plain text.
  const keep = new Set([...valid].filter((id) => wanted.includes(id)));
  return { body: neutralizeMentions(input.body, keep), ids: [...keep] };
}

export type WriteMentions = {
  sourceType: SourceType;
  sourceId: number;
  communityId: number | null;
  authorId: string;
  ids: string[];
  /** Community content only: where a notification should lead. */
  notify?: { postId: number; commentId?: number; skip?: ReadonlySet<string> };
};

export async function writeMentions(w: WriteMentions): Promise<{ added: string[]; removed: string[] }> {
  const existing = await db()
    .select({ id: communityMentions.mentionedUserId })
    .from(communityMentions)
    .where(and(eq(communityMentions.sourceType, w.sourceType), eq(communityMentions.sourceId, w.sourceId)));
  const had = new Set(existing.map((r) => r.id));
  const want = new Set(w.ids);
  const added = w.ids.filter((id) => !had.has(id));
  const removed = [...had].filter((id) => !want.has(id));
  const now = new Date();

  if (added.length) {
    await db()
      .insert(communityMentions)
      .values(added.map((id) => ({ communityId: w.communityId, sourceType: w.sourceType, sourceId: w.sourceId, mentionedUserId: id, authorId: w.authorId, createdAt: now })))
      .onConflictDoNothing();
  }
  if (removed.length) {
    await db().delete(communityMentions).where(and(eq(communityMentions.sourceType, w.sourceType), eq(communityMentions.sourceId, w.sourceId), inArray(communityMentions.mentionedUserId, removed)));
    if (w.notify) {
      await db()
        .delete(communityNotifications)
        .where(and(eq(communityNotifications.type, "mention"), eq(communityNotifications.sourceType, w.sourceType), eq(communityNotifications.sourceId, w.sourceId), inArray(communityNotifications.userId, removed)));
    }
  }

  if (added.length && w.notify && w.communityId !== null) {
    const skip = w.notify.skip ?? new Set<string>();
    const candidates = added.filter((id) => id !== w.authorId && !skip.has(id));
    if (candidates.length) {
      const blockers = await db().select({ id: communityBlocks.blockerId }).from(communityBlocks).where(and(eq(communityBlocks.blockedId, w.authorId), inArray(communityBlocks.blockerId, candidates)));
      const no = new Set(blockers.map((b) => b.id));
      const rows = candidates.filter((id) => !no.has(id));
      if (rows.length) {
        await db().insert(communityNotifications).values(
          rows.map((userId) => ({ userId, type: "mention", actorId: w.authorId, communityId: w.communityId as number, postId: w.notify!.postId, commentId: w.notify!.commentId ?? null, sourceType: w.sourceType, sourceId: w.sourceId, createdAt: now })),
        );
      }
    }
  }
  return { added, removed };
}

/** Removes the mention rows and notifications that belong to content that is gone. */
export async function dropMentionsFor(sourceType: SourceType, ids: number[]) {
  if (!ids.length) return;
  await db().delete(communityMentions).where(and(eq(communityMentions.sourceType, sourceType), inArray(communityMentions.sourceId, ids)));
  if (sourceType !== "message") await db().delete(communityNotifications).where(and(eq(communityNotifications.type, "mention"), eq(communityNotifications.sourceType, sourceType), inArray(communityNotifications.sourceId, ids)));
}

export const mentionCount = sql<number>`count(*)::int`;
