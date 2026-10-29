import { api, ok, readBody, type Ctx } from "@/modules/community/server/api";
import { editComment, getCommentRow, setCommentStatus } from "@/modules/community/server/comments";
import { notFound, toId } from "@/modules/community/server/core";
import { scopeById } from "@/modules/community/server/context";

export const runtime = "nodejs";

async function load(viewer: Parameters<typeof scopeById>[0], raw: string) {
  const id = toId(raw);
  const comment = id ? await getCommentRow(id) : null;
  if (!comment || comment.status === "deleted") throw notFound();
  return { comment, scope: await scopeById(viewer, comment.communityId) };
}

export async function PATCH(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const { comment, scope } = await load(viewer, (await ctx.params).id);
    const b = await readBody(request);
    if (b.status === "hidden_by_mod" || b.status === "published") {
      await setCommentStatus(scope, comment, b.status);
      return ok({ ok: true });
    }
    return ok(await editComment(scope, comment, b.body));
  });
}

export async function DELETE(request: Request, ctx: Ctx<"id">) {
  return api(request, async (viewer) => {
    const { comment, scope } = await load(viewer, (await ctx.params).id);
    await setCommentStatus(scope, comment, "deleted");
    return ok({ ok: true });
  });
}
