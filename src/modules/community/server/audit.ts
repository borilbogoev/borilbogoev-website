import { schema } from "@/db";
import { db } from "./core";

/** One line in the admin log. */
export async function log(actorId: string, action: string, targetType: string, targetId: string | number, meta: Record<string, unknown> = {}) {
  await db().insert(schema.communityAdminLog).values({ actorId, action, targetType, targetId: String(targetId), meta, createdAt: new Date() });
}
