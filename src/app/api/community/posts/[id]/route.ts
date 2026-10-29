import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { notFound, toId } from "@/modules/community/server/core";
import { scopeById } from "@/modules/community/server/context";
import { editPost, getPost, getPostRow, setPostStatus, updatePostMeta } from "@/modules/community/server/posts";

export const runtime = "nodejs";

async function load(viewer: Parameters<typeof scopeById>[0], raw: string) {
  const id = toId(raw);
  const post = id ? await getPostRow(id) : null;
  if (!post || post.status === "deleted") throw notFound();
  return { post, scope: await scopeById(viewer, post.communityId) };
}

export async function GET(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const { post, scope } = await load(viewer, (await ctx.params).id);
    const res = await getPost(scope, post.id);
    if (!res) throw notFound();
    return ok(res);
  });
}

// Body edits by the author or the SuperAdmin. The SuperAdmin also sends { pinned }, { commentsLocked }, { categoryId }. Moderators send { status: "hidden_by_mod" | "published" }.
export async function PATCH(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const { post, scope } = await load(viewer, (await ctx.params).id);
    const b = await readBody(request);
    if (b.status === "hidden_by_mod" || b.status === "published") {
      await setPostStatus(scope, post, b.status);
      return ok({ ok: true });
    }
    if (b.pinned !== undefined || b.commentsLocked !== undefined || b.categoryId !== undefined) {
      await updatePostMeta(scope, post, {
        pinned: typeof b.pinned === "boolean" ? b.pinned : undefined,
        commentsLocked: typeof b.commentsLocked === "boolean" ? b.commentsLocked : undefined,
        categoryId: b.categoryId === undefined ? undefined : b.categoryId === null ? null : Number(b.categoryId),
      });
      return ok({ ok: true });
    }
    return ok(await editPost(scope, post, b.body));
  });
}

export async function DELETE(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const { post, scope } = await load(viewer, (await ctx.params).id);
    await setPostStatus(scope, post, "deleted");
    return ok({ ok: true });
  });
}
