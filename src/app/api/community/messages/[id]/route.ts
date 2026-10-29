import { api, ok, type Ctx } from "@/modules/community/server/api";
import { deleteMessage } from "@/modules/community/server/chat";
import { notFound, toId } from "@/modules/community/server/core";

export const runtime = "nodejs";

export async function DELETE(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    await deleteMessage(viewer, id);
    return ok({ ok: true });
  }, { membership: false });
}
