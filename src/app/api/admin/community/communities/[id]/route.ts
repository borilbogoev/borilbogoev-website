import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { notFound, toId } from "@/modules/community/server/core";
import { deleteCommunity, setDefaultCommunity, updateCommunity } from "@/modules/community/server/admin";

export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const b = await readBody(request);
    if (b.setDefault === true) {
      await setDefaultCommunity(viewer, id);
      return ok({ ok: true });
    }
    await updateCommunity(viewer, id, b);
    return ok({ ok: true });
  }, { membership: false });
}

/** Body: { mode: "transfer", targetId } or { mode: "delete" }, plus { confirm: <slug> }. */
export async function DELETE(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const id = toId((await ctx.params).id);
    if (!id) throw notFound();
    const out = await deleteCommunity(viewer, id, await readBody(request));
    return ok({ ok: true, ...out });
  }, { membership: false });
}
