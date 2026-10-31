import { guarded, json } from "@/modules/auth/guard";
import { ensureTag, listTags } from "@/modules/users/server/query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return guarded(request, "users.manage", async () => json({ tags: await listTags() }, 200));
}

export async function POST(request: Request) {
  return guarded(request, "users.manage", async (actor) => {
    const b = (await request.json().catch(() => ({}))) as { name?: string; description?: string };
    try {
      const tag = await ensureTag(String(b.name ?? ""), actor.id);
      if (typeof b.description === "string" && tag.created) {
        const { db } = await import("@/db/use");
        const { sql } = await import("drizzle-orm");
        await db().execute(sql`UPDATE user_tags SET description = ${b.description.slice(0, 300)} WHERE id = ${tag.id}`);
      }
      return json({ tag }, tag.created ? 201 : 200);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Could not save the tag." }, 400);
    }
  });
}
