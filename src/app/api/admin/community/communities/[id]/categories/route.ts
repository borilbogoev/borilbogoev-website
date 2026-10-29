import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { notFound, toId } from "@/modules/community/server/core";
import { createCategory, listCategories, reorderCategories } from "@/modules/community/server/categories";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: Ctx<"id">) {
  return api(request, async () => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    return ok({ items: await listCategories(id, { all: true }) });
  }, { membership: false });
}

// { name, status?, sortRule? } creates; { order: [ids] } reorders.
export async function POST(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const b = await readBody(request);
    if (Array.isArray(b.order)) {
      await reorderCategories(viewer, id, b.order.filter((x): x is number => Number.isInteger(x)));
      return ok({ ok: true });
    }
    return ok({ item: await createCategory(viewer, id, b) }, 201);
  }, { membership: false });
}
