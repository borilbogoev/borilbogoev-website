import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db/use";
import { guarded, json } from "@/modules/auth/guard";
import { slugify } from "@/modules/users/server/query";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const idOf = async (ctx: Ctx) => {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function PATCH(request: Request, ctx: Ctx) {
  return guarded(request, "users.manage", async () => {
    const id = await idOf(ctx);
    if (!id) return json({ error: "Tag not found." }, 404);
    const b = (await request.json().catch(() => ({}))) as { name?: string; description?: string };
    const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim().slice(0, 60) : undefined;
    if (name !== undefined) {
      const slug = slugify(name);
      if (!slug) return json({ error: "Give the tag a name." }, 400);
      const [clash] = rowsOf<{ id: number }>(await db().execute(sql`SELECT id FROM user_tags WHERE slug = ${slug} AND id <> ${id}`));
      if (clash) return json({ error: "Another tag already has this name." }, 409);
      await db().execute(sql`UPDATE user_tags SET name = ${name}, slug = ${slug} WHERE id = ${id}`);
    }
    if (typeof b.description === "string") await db().execute(sql`UPDATE user_tags SET description = ${b.description.slice(0, 300)} WHERE id = ${id}`);
    return json({ ok: true }, 200);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "users.manage", async () => {
    const id = await idOf(ctx);
    if (!id) return json({ error: "Tag not found." }, 404);
    await db().execute(sql`DELETE FROM user_tags WHERE id = ${id}`); // memberships go with it (cascade)
    return json({ deleted: true }, 200);
  });
}
