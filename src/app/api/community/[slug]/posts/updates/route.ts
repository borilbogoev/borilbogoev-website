import { api, ok, type Ctx } from "@/modules/community/server/api";
import { scopeBySlug } from "@/modules/community/server/context";
import { feedUpdates } from "@/modules/community/server/posts";

export const runtime = "nodejs";

// The cheap poll: one indexed count, tiny body.
export async function GET(request: Request, ctx: Ctx<"slug">) {
  return api(request, async (viewer) => ok(await feedUpdates(await scopeBySlug(viewer, (await ctx.params).slug), new URL(request.url).searchParams.get("after"))), { membership: false });
}
