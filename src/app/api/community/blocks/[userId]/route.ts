import { api, ok, type Ctx } from "@/modules/community/server/api";
import { unblockUser } from "@/modules/community/server/safety";

export const runtime = "nodejs";

export async function DELETE(request: Request, ctx: Ctx<"userId">) {
  return api(request, async (viewer) => {
    await unblockUser(viewer, (await ctx.params).userId);
    return ok({ ok: true });
  }, { membership: false });
}
