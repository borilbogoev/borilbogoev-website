// Rate limits that survive serverless: count the person's own rows in the window. The SuperAdmin is exempt.
import { sql } from "drizzle-orm";
import { CommunityError, asDate, run } from "./core";
import type { Viewer } from "./context";
import { getSettings } from "./settings";

const KINDS = {
  post: { table: "community_posts", col: "author_id", windowMs: 3_600_000, limit: (s: Awaited<ReturnType<typeof getSettings>>) => s.ratePostPerHour },
  comment: { table: "community_comments", col: "author_id", windowMs: 3_600_000, limit: (s: Awaited<ReturnType<typeof getSettings>>) => s.rateCommentPerHour },
  message: { table: "community_messages", col: "sender_id", windowMs: 60_000, limit: (s: Awaited<ReturnType<typeof getSettings>>) => s.rateMessagePerMinute },
} as const;

export async function checkRate(viewer: Viewer, kind: keyof typeof KINDS): Promise<void> {
  if (viewer.actor.superAdmin) return;
  const k = KINDS[kind];
  const limit = k.limit(await getSettings());
  const since = new Date(Date.now() - k.windowMs);
  const [row] = await run<{ n: number; oldest: unknown }>(sql`SELECT count(*)::int AS n, min(created_at) AS oldest FROM ${sql.raw(k.table)} WHERE ${sql.raw(k.col)} = ${viewer.user.id} AND created_at > ${since}`);
  if ((row?.n ?? 0) >= limit) {
    const free = row?.oldest ? asDate(row.oldest).getTime() + k.windowMs - Date.now() : k.windowMs;
    const retryAfter = Math.max(1, Math.ceil(free / 1000));
    throw new CommunityError(429, `You are doing that too fast. Try again in ${retryAfter} seconds.`, { retryAfter });
  }
}
