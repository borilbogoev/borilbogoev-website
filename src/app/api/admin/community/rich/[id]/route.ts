import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { notFound, toId } from "@/modules/community/server/core";
import { getRich, saveRich } from "@/modules/community/server/rich";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    return ok({ post: await getRich(viewer, id) });
  }, { membership: false });
}

export async function PUT(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    return ok({ post: await saveRich(viewer, id, await readBody(request)) });
  }, { membership: false });
}
