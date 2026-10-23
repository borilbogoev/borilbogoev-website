import { json } from "@/modules/auth/guard";
import { deleteComment, updateComment } from "@/modules/school/lib/learn";
import { isModerator, learner } from "@/modules/school/lib/lesson-api";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const body = (await request.json().catch(() => ({}))) as Parameters<typeof updateComment>[2];
    const res = await updateComment(Number((await ctx.params).id), { id: user.id, moderator: isModerator(user) }, body);
    return res.ok ? json({ saved: true }, 200) : json({ error: res.error }, res.status);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return learner(request, async (user) => {
    const res = await deleteComment(Number((await ctx.params).id), { id: user.id, moderator: isModerator(user) });
    return res.ok ? json({ deleted: true }, 200) : json({ error: res.error }, res.status);
  });
}
