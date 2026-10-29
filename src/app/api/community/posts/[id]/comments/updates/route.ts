import { api, ok, type Ctx } from "@/modules/community/server/api";
import { listComments } from "@/modules/community/server/comments";
import { notFound, toId } from "@/modules/community/server/core";
import { scopeById } from "@/modules/community/server/context";
import { getPostRow } from "@/modules/community/server/posts";

export const runtime = "nodejs";

// Comments newer than the cursor. Usually an empty list.
export async function GET(request: Request, ctx: Ctx<"id">) {
  return api(
    request,
    async (viewer) => {
      const id = toId((await ctx.params).id);
      const post = id ? await getPostRow(id) : null;
      if (!post || post.status !== "published") throw notFound();
      const after = new URL(request.url).searchParams.get("after");
      const res = await listComments(await scopeById(viewer, post.communityId), post.id, after, 50);
      return ok({ items: res.items, people: res.people, commentCount: post.commentCount });
    },
    { membership: false },
  );
}
