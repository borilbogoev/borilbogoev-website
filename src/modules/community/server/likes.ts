// Likes on posts and comments. The like row and the counter change in one SQL statement.
import { sql } from "drizzle-orm";
import { schema } from "@/db";
import { db, notFound, run } from "./core";
import { communityState, memberState, scopeById, type Viewer } from "./context";
import { canReact } from "./permissions";
import { unwrap } from "./posts";
import { eq } from "drizzle-orm";

const { communityPosts: P, communityComments: C } = schema;

export async function setLike(viewer: Viewer, type: "post" | "comment", id: number, like: boolean): Promise<{ liked: boolean; likeCount: number }> {
  const [row] =
    type === "post"
      ? await db().select({ communityId: P.communityId, status: P.status }).from(P).where(eq(P.id, id)).limit(1)
      : await db().select({ communityId: C.communityId, status: C.status }).from(C).where(eq(C.id, id)).limit(1);
  if (!row || row.status !== "published") throw notFound();
  const scope = await scopeById(viewer, row.communityId);
  unwrap(canReact(viewer.actor, memberState(scope.membership), communityState(scope.community), scope.settings));
  const table = sql.raw(type === "post" ? "community_posts" : "community_comments");
  const me = viewer.user.id;
  if (like) {
    await run(sql`
      WITH l AS (INSERT INTO community_likes (user_id, target_type, target_id, created_at) VALUES (${me}, ${type}, ${id}, ${new Date()}) ON CONFLICT DO NOTHING RETURNING id)
      UPDATE ${table} SET like_count = like_count + (SELECT count(*) FROM l)::int WHERE id = ${id}`);
  } else {
    await run(sql`
      WITH l AS (DELETE FROM community_likes WHERE user_id = ${me} AND target_type = ${type} AND target_id = ${id} RETURNING id)
      UPDATE ${table} SET like_count = greatest(like_count - (SELECT count(*) FROM l)::int, 0) WHERE id = ${id}`);
  }
  const [r] = await run<{ n: number }>(sql`SELECT like_count AS n FROM ${table} WHERE id = ${id}`);
  return { liked: like, likeCount: r?.n ?? 0 };
}
