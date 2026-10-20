import { guarded, json } from "@/modules/auth/guard";
import { deleteCategory, listCategories, renameCategory } from "@/modules/presentations/lib/presentations";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  return guarded(request, "presentations.write", async () => {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const res = await renameCategory(Number((await ctx.params).id), String(body.name ?? ""));
    return res.ok ? json({ categories: await listCategories() }, 200) : json({ error: res.error }, 409);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return guarded(request, "presentations.delete", async () => {
    await deleteCategory(Number((await ctx.params).id));
    return json({ categories: await listCategories() }, 200);
  });
}
