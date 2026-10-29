import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { notFound, toId } from "@/modules/community/server/core";
import { deleteCategory, updateCategory } from "@/modules/community/server/categories";

export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    return ok({ item: await updateCategory(viewer, id, await readBody(request)) });
  }, { membership: false });
}

export async function DELETE(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    await deleteCategory(viewer, id);
    return ok({ ok: true });
  }, { membership: false });
}
