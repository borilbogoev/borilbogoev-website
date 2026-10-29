import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { toId } from "@/modules/community/server/core";
import { scopeBySlug } from "@/modules/community/server/context";
import { createPost, effectiveSort, listFeed } from "@/modules/community/server/posts";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: Ctx<"slug">) {
  return api(request, async (viewer) => {
    const scope = await scopeBySlug(viewer, (await ctx.params).slug);
    const url = new URL(request.url);
    const categoryId = toId(url.searchParams.get("categoryId"));
    const sort = await effectiveSort(scope, categoryId, url.searchParams.get("sort"));
    return ok(await listFeed(scope, { sort, categoryId, cursor: url.searchParams.get("cursor"), after: url.searchParams.get("after") }));
  });
}

export async function POST(request: Request, ctx: Ctx<"slug">) {
  return api(request, async (viewer) => {
    const scope = await scopeBySlug(viewer, (await ctx.params).slug);
    const b = await readBody(request);
    const mediaIds = Array.isArray(b.mediaIds) ? b.mediaIds.filter((x): x is number => Number.isInteger(x)).slice(0, 10) : [];
    const res = await createPost(scope, { body: b.body, mediaIds, alts: b.alts && typeof b.alts === "object" ? (b.alts as Record<string, unknown>) : undefined, categoryId: b.categoryId, requestId: typeof b.requestId === "string" ? b.requestId : null });
    return ok(res, res.duplicate ? 200 : 201);
  });
}
