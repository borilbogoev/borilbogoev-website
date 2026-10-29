import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { scopeBySlug } from "@/modules/community/server/context";
import { createPost, listFeed } from "@/modules/community/server/posts";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: Ctx<"slug">) {
  return api(request, async (viewer) => {
    const scope = await scopeBySlug(viewer, (await ctx.params).slug);
    const url = new URL(request.url);
    return ok(await listFeed(scope, { cursor: url.searchParams.get("cursor"), after: url.searchParams.get("after") }));
  });
}

export async function POST(request: Request, ctx: Ctx<"slug">) {
  return api(request, async (viewer) => {
    const scope = await scopeBySlug(viewer, (await ctx.params).slug);
    const b = await readBody(request);
    const mediaIds = Array.isArray(b.mediaIds) ? b.mediaIds.filter((x): x is number => Number.isInteger(x)).slice(0, 10) : [];
    const res = await createPost(scope, { body: b.body, mediaIds, requestId: typeof b.requestId === "string" ? b.requestId : null });
    return ok(res, res.duplicate ? 200 : 201);
  });
}
