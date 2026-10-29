import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { createComment, listComments } from "@/modules/community/server/comments";
import { notFound, toId } from "@/modules/community/server/core";
import { scopeById } from "@/modules/community/server/context";
import { getPostRow } from "@/modules/community/server/posts";

export const runtime = "nodejs";

async function load(viewer: Parameters<typeof scopeById>[0], raw: string) {
  const id = toId(raw);
  const post = id ? await getPostRow(id) : null;
  if (!post || post.status !== "published") throw notFound();
  return { post, scope: await scopeById(viewer, post.communityId) };
}

export async function GET(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const { post, scope } = await load(viewer, (await ctx.params).id);
    return ok(await listComments(scope, post.id, new URL(request.url).searchParams.get("cursor")));
  });
}

export async function POST(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const { post, scope } = await load(viewer, (await ctx.params).id);
    const b = await readBody(request);
    const res = await createComment(scope, post.id, { body: b.body, requestId: typeof b.requestId === "string" ? b.requestId : null });
    return ok(res, res.duplicate ? 200 : 201);
  });
}
