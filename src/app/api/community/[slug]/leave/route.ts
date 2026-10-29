import { api, ok, type Ctx } from "@/modules/community/server/api";
import { scopeBySlug } from "@/modules/community/server/context";
import { leaveCommunity } from "@/modules/community/server/communities";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: Ctx<"slug">) {
  return api(request, async (viewer) => {
    await leaveCommunity(await scopeBySlug(viewer, (await ctx.params).slug));
    return ok({ ok: true });
  });
}
